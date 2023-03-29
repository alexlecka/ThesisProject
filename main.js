var CaptureTools = require('users/alexandralecka/MyThesis:Modules/CaptureTools.js');
var CloudFilter = require('users/alexandralecka/MyThesis:Modules/CloudFiltering.js');

// define the true area boundary and the buffered area boundary
var aoi_true = table.geometry();
var aoi_buffered = table2.geometry();

// define start and end date
var start = ee.Date('2019-05-01');
var end = start.advance(5, 'month');

var training = false;

if (training) {
  var data_mask = ee.FeatureCollection(table5).filterBounds(aoi_true);

  var train_features = ee.FeatureCollection(table3);
  var test_features = ee.FeatureCollection(table4);
  
  var train_raster = train_features.reduceToImage({properties: ['rh98'], reducer: ee.Reducer.first()});
  var train_mask = train_raster.gte(0).clipToCollection(train_features);
  var test_raster = test_features.reduceToImage({properties: ['rh98'], reducer: ee.Reducer.first()});
  var test_mask = test_raster.gte(0).clipToCollection(test_features);
  
  var image = CaptureTools.get_image(aoi_true, aoi_buffered, start, end, train_features, test_features, true)();
} else {
  var image = CaptureTools.get_image(aoi_true, aoi_buffered, start, end, null, null, false)().toFloat();
}

print(image);

//var visTrain = {min: 0, max: 0, palette: ['FF0000', '0000FF']};
//var visTest = {min: 0, max: 0, palette: ['0000FF', 'FF0000']};

//Map.centerObject(aoi_true);
//Map.addLayer(image.clip(aoi_true), {bands: ['B4', 'B3', 'B2'], max: 0.3}, 'RGB');

/*
// exporting as tiff
Export.image.toDrive({
  image: image,
  description: 'YEAR_SITE',
  folder: 'GEE_downloads',
  crs: 'EPSG:4326',
  region: aoi_true,
  scale: 10,
  maxPixels: 1e10
});

// exporting as tfrecord
Export.image.toDrive({
  image: image,
  description: 'YEAR_SITE',
  scale: 10,
  region: aoi_buffered,
  folder: 'GEE_downloads',
  crs: 'EPSG:4326',
  fileFormat: 'TFRecord',
  maxPixels: 1e10,
  formatOptions: {
    patchDimensions: [105, 105]
  }
});*/
