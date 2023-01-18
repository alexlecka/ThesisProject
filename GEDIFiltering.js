exports.qualityMask = function(img) {
  // to get rid of pixels with quality flag 0 and degrade flag 1
  return img.updateMask(img.select('quality_flag').eq(1))
    .updateMask(img.select('degrade_flag').eq(0));
};

exports.beamMask = function(img) {
  // retain only pixels corresponding to full power beams
  var beam5 = img.select('beam').eq(5);
  var beam6 = img.select('beam').eq(6);
  var beam8 = img.select('beam').eq(8);
  var beam11 = img.select('beam').eq(11);
  var beam = ((beam5.add(beam6)).add(beam8)).add(beam11);
  
  return img.updateMask(beam);
};

exports.nightMask = function(img) {
  // retain only pixel corresponding to negative angles (night measurements)
  var night = img.select('solar_azimuth').lt(0);
  return img.updateMask(night);
};

exports.leafMask = function(img) {
  // retain only pixels from measurement within the leafy season
  var leaf = img.select('leaf_on_cycle').eq(1);
  return img.updateMask(leaf);
};
