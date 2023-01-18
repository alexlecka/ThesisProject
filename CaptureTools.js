var CloudFilter = require('users/alexandralecka/MyThesis:Modules/CloudFiltering.js');
var GEDIFilter = require('users/alexandralecka/MyThesis:Modules/GEDIFiltering.js');

function add_sar_bands(img) {
  var sar_bands = ee.Image(img.get('s1')).select(['VV', 'VH']);
  return img.addBands(sar_bands);
}

function get_s2_and_s1_collection(AOI, START_DATE, END_DATE) {
  // import and filter S2 SR
  var s2_sr_col = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(AOI)
    .filterDate(START_DATE, END_DATE);

  var s1_sar_col = ee.ImageCollection('COPERNICUS/S1_GRD_FLOAT')
    .filterBounds(AOI)
    .filterDate(START_DATE, END_DATE)
    // filter to get images with VV and VH dual polarization
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // filter to get images collected in interferometric wide swath mode
    .filter(ee.Filter.eq('instrumentMode', 'IW'));

  // import and filter s2cloudless (probability that the pixel is cloudy)
  var s2_cloudless_col = (ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
    .filterBounds(AOI)
    .filterDate(START_DATE, END_DATE));

  // join the filtered s2cloudless collection to the SR collection by the 'system:index' property
  var s2 = ee.ImageCollection(ee.Join.saveFirst('s2cloudless').apply({
    'primary': s2_sr_col,
    'secondary': s2_cloudless_col,
    'condition': ee.Filter.equals({
      'leftField': 'system:index',
      'rightField': 'system:index'
    })
  }));

  var maxDiffFilter = ee.Filter.maxDifference({
    difference: 2 * 24 * 60 * 60 * 1000,
    leftField: 'system:time_start',
    rightField: 'system:time_start'
  });

  // define the join
  var saveBestJoin = ee.Join.saveBest({
    matchKey: 's1',
    measureKey: 'timeDiff'
  });

  return ee.ImageCollection(saveBestJoin.apply(s2, s1_sar_col, maxDiffFilter));
}

exports.get_image = function(AOI_TRUE, AOI_BUFFERED, START_DATE, END_DATE) {
  return function () {
    // define the s1 and s2 image collection
    var s2_and_s1_collection = get_s2_and_s1_collection(AOI_BUFFERED, START_DATE, END_DATE);
    
    // add cloudmask and s1 sar bands
    var clouded = s2_and_s1_collection.map(CloudFilter.add_cld_shdw_mask).map(add_sar_bands);

    // define VV and VH ratio and get mean of VV and VH
    var ratio = clouded.map(function (img) {
      var VV = img.select('VV');
      var VH = img.select('VH');
      return VV.divide(VH).rename('ratio');
    });
    var s1 = clouded.select(['VV', 'VH']);
    var combinedReducer = ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    });
    s1 = s1.reduce(combinedReducer);

    // filter out clouds from s2 and mean over the collection
    var s2_cloudless = clouded.select(['B.*', 'cloudmask']).map(CloudFilter.filterClouds);
    var for_scl = clouded.select(['SCL', 'cloudmask']).map(CloudFilter.filterClouds);
    var s2 = s2_cloudless.select(['B.*']).mean();

    // define mosaic for identifying water and vegetation areas
    var scl = for_scl.mosaic().select('SCL');
    var water = scl.eq(6).not();
    var veg = scl.eq(4);
    
    var vis = {
      min: 0.0,
      max: 1.0,
      pallete: ['000000', 'FFFFFF'] // black for 0, white for 1
    };
    
    // apply mask, but just to set 'bad' pixels to zero
    s1 = s1.updateMask(veg).updateMask(water);
    s2 = s2.updateMask(veg).updateMask(water);
    
    // build a GEDI image collection
    var dataset_buffered = ee.ImageCollection('LARSE/GEDI/GEDI02_A_002_MONTHLY')
      .filterBounds(AOI_BUFFERED)
      .filterDate(START_DATE, END_DATE)
      .map(GEDIFilter.qualityMask)
      .map(GEDIFilter.beamMask)
      .map(GEDIFilter.nightMask)
      .map(GEDIFilter.leafMask)
      .select('rh98', 'beam', 'solar_azimuth', 'leaf_on_cycle');
      
    var GEDI_buffered = dataset_buffered.mosaic().toFloat().clip(AOI_BUFFERED);
    
    var GEDI_TRUE = dataset_buffered.mosaic().toFloat().clip(AOI_TRUE);
    var trueMask = GEDI_TRUE.select('rh98').eq(GEDI_TRUE.select('rh98'));

    var AOI_DIFF = AOI_BUFFERED.difference({'right': AOI_TRUE, 'maxError': 1});
    var GEDI_diff = dataset_buffered.mosaic().toFloat().clip(AOI_DIFF);
    // do this to ensure they are different
    var addition = GEDI_diff.select('rh98').eq(GEDI_diff.select('rh98')); 
    GEDI_diff = GEDI_diff.select('rh98').add(addition);
    var diffMask = GEDI_buffered.select('rh98').eq(GEDI_diff.select('rh98'));
    
    var combinedMask = ee.ImageCollection([trueMask, diffMask]).mosaic();
    var rh98_masked = GEDI_buffered.select('rh98').multiply(combinedMask).rename('rh98_masked');
      
    rh98_masked = rh98_masked.updateMask(water).updateMask(veg).rename('rh98');
    s1 = s1.select(['VV_mean', 'VH_mean']).rename(['VV', 'VH']);

    var mask = s2
      .select('B1')
      .neq(0)
      .rename('s2_data');

    // by now S2 bands are masked out where there is water or is NOT vegetation and are clouds, 
    // same for GEDI rh98
    return rh98_masked
      .addBands(s2.select(['B.*']))
      .addBands(s1.select('VV', 'VH'))
      .updateMask(mask)
      .updateMask(combinedMask);
  };
};
