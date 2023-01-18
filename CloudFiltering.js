function add_cloud_bands(img) {
  // get s2cloudless image, subset the probability band
  var cld_prb = ee.Image(img.get('s2cloudless')).select('probability');
  
  var CLD_PRB_THRESH = 50;
  // condition s2cloudless by the probability threshold value
  var is_cloud = cld_prb.gt(CLD_PRB_THRESH).rename('clouds');
  
  // add the cloud probability layer and cloud mask layer as image bands
  return img.addBands(ee.Image([cld_prb, is_cloud]));
}

function add_shadow_bands(img) {
  // identify water pixels from the SCL band
  var not_water = img.select('SCL').neq(6); // because SCL 6 is water pixel
  
  // identify dark NIR pixels that are not water (potential cloud shadow pixels)
  var NIR_DRK_THRESH = 0.15;
  var SR_BAND_SCALE = 1e4;
  var dark_pixels = img.select('B8').lt(NIR_DRK_THRESH*SR_BAND_SCALE).multiply(not_water).rename('dark_pixels');
  
  // determine the direction to project cloud shadow from clouds (assumes UTM projection)
  var shadow_azimuth = ee.Number(90).subtract(ee.Number(img.get('MEAN_SOLAR_AZIMUTH_ANGLE')));
  
  // project shadows from clouds for the distance specified by the CLD_PRJ_DIST input
  var CLD_PRJ_DIST = 1;
  var cld_proj = img.select('clouds').directionalDistanceTransform(shadow_azimuth, CLD_PRJ_DIST*10)
    .reproject({
      'crs':img.select(0).projection(),
      'scale': 100})
    .select('distance')
    .mask()
    .rename('cloud_transform');
  
  // identify the intersection of dark pixels with the cloud shadow projection
  var shadows = cld_proj.multiply(dark_pixels).rename('shadows');
  
  // add dark pixels, cloud projection, and identified shadows as image bands
  return img.addBands(ee.Image([dark_pixels, cld_proj, shadows]));
}

exports.add_cld_shdw_mask = function(img) {
  // add cloud component bands
  var img_cloud = add_cloud_bands(img);
  
  // add cloud shadow component bands
  var img_cloud_shadow = add_shadow_bands(img_cloud);
  
  // combine cloud and shadow mask, set cloud and shadow as value 1, else 0
  var is_cld_shdw = img_cloud_shadow.select('clouds').add(img_cloud_shadow.select('shadows')).gt(0);
  
  // remove small cloud-shadow patched and dilate remaining pixels by BUFFER input
  // 20 m scale is for speed, and assumes cloud don't require 10 m precision
  var BUFFER = 50;
  is_cld_shdw = (is_cld_shdw.focalMin(2).focalMax(BUFFER*2/20)
    .reproject({
      'crs': img.select([0]).projection(),
      'scale': 20})
    .rename('cloudmask'));
    
  // add the final cloud-shadow mask to the image
  // return img_cloud_shadow.addBands(is_cld_shdw);
  return img.addBands(is_cld_shdw); // to just edit the starting image
};

exports.filterClouds = function(img) {
// function to filter out clouds in each image of an image collection
  var cloud = img.select('cloudmask');
  return img.updateMask(cloud.neq(1));
};
