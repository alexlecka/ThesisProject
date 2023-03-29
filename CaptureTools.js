var CloudFilter = require('users/alexandralecka/MyThesis:Modules/CloudFiltering.js');
var GEDIFilter = require('users/alexandralecka/MyThesis:Modules/GEDIFiltering.js');

function get_s2_collection(AOI, START_DATE, END_DATE) {
  // import and filter S2 SR
  var s2_sr_col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(AOI)
    .filterDate(START_DATE, END_DATE);
    
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
  
  return s2;
}

// identify water pixels from SCL bands
function water_func(img) {
  return img.eq(6);
}

exports.get_image = function(AOI_TRUE, AOI_BUFFERED, START_DATE, END_DATE, TRAIN_COLL, TEST_COLL, training) {
  return function () {
    // define the s2 image collection
    var s2_collection = get_s2_collection(AOI_BUFFERED, START_DATE, END_DATE)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40));
      
    // define mosaic for identifying water pixels
    var water_bool = s2_collection.select('SCL').map(water_func);
    var water_prob = water_bool.mean();
    var non_water = water_prob.gt(0).neq(1);

    // define s2 image by masking clouds and calculating average pixel values
    var s2 = s2_collection.map(CloudFilter.filterClouds).select(['B.*']).mean().toFloat();
    var mask = s2
      .select('B1')
      .neq(0)
      .rename('s2_data');

    if (training) {
      // build a GEDI image collection 
      var dataset_buffered = ee.ImageCollection('LARSE/GEDI/GEDI02_A_002_MONTHLY')
        .filterBounds(AOI_BUFFERED)
        .filterDate(START_DATE, END_DATE)
        .map(GEDIFilter.qualityMask)
        .map(GEDIFilter.beamMask)
        .map(GEDIFilter.nightMask)
        .map(GEDIFilter.leafMask)
        .select('rh98');
      
      var GEDI_buffered = dataset_buffered.mosaic().toFloat().clip(AOI_BUFFERED);
      
      var GEDI_TRAIN = dataset_buffered.mosaic().toFloat().clipToCollection(TRAIN_COLL).clip(AOI_TRUE);
      var GEDI_TEST = dataset_buffered.mosaic().toFloat().clipToCollection(TEST_COLL).clip(AOI_TRUE);
      
      var trainMask = GEDI_TRAIN.eq(GEDI_TRAIN);
      var testMask = GEDI_TEST.eq(GEDI_TEST);
  
      var AOI_DIFF = AOI_BUFFERED.difference({'right': AOI_TRUE, 'maxError': 1});
      var GEDI_diff = dataset_buffered.mosaic().toFloat().clip(AOI_DIFF);
      
      var addition = GEDI_diff.eq(GEDI_diff); 
      GEDI_diff = GEDI_diff.add(addition);
      var diffMask = GEDI_buffered.eq(GEDI_diff);
      
      trainMask = ee.ImageCollection([trainMask, diffMask]).mosaic();
      var rh98_train = GEDI_buffered.multiply(trainMask).updateMask(non_water).multiply(100).round().toInt().toFloat().divide(100).rename('rh98_train');
      
      testMask = ee.ImageCollection([testMask, diffMask]).mosaic();
      var rh98_test = GEDI_buffered.multiply(testMask).updateMask(non_water).multiply(100).round().toInt().toFloat().divide(100).rename('rh98_test');
      
      return rh98_train.addBands(rh98_test)
        .addBands(s2.select(['B.*']))
        .addBands(non_water)
        .updateMask(mask);
    } else {
      var rh98 = non_water.neq(10).rename('rh98');
      
      return rh98
        .addBands(s2.select(['B.*']))
        .addBands(non_water)
        .updateMask(mask);
    }
  };
};
