// filter out pixels with quality flag 0 and degrade flag 1
exports.qualityMask = function(img) {
  return img.updateMask(img.select('quality_flag').eq(1))
    .updateMask(img.select('degrade_flag').eq(0));
};

// filter out observations acquired by the coverage beam of GEDI
exports.beamMask = function(img) {
  var beam5 = img.select('beam').eq(5);
  var beam6 = img.select('beam').eq(6);
  var beam8 = img.select('beam').eq(8);
  var beam11 = img.select('beam').eq(11);
  var beam = ((beam5.add(beam6)).add(beam8)).add(beam11);
  
  return img.updateMask(beam);
};

// filter out observations made during the day
exports.nightMask = function(img) {
  var night = img.select('solar_azimuth').lt(0);
  return img.updateMask(night);
};

// filter out observations from outside the leaf-on season
exports.leafMask = function(img) {
  var leaf = img.select('leaf_on_cycle').eq(1);
  return img.updateMask(leaf);
};
