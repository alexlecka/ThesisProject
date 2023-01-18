var CaptureTools = require('users/alexandralecka/MyThesis:Modules/CaptureTools.js');
var CloudFilter = require('users/alexandralecka/MyThesis:Modules/CloudFiltering.js');

// define the true boundary and the buffered boundary
var aoi_true = split_9.geometry();
var aoi_buffered = split_9_buffered.geometry();

// define start and end date
var start = ee.Date('2019-01-01');
var end = start.advance(1, 'year');

var image = CaptureTools.get_image(aoi_true, aoi_buffered, start, end)();

Export.image.toDrive({
  image: image.clip(aoi_true).toFloat(),
  description: 'split_1',
  folder: 'GEE_downloads',
  crs: 'EPSG:4326',
  region: aoi_true,
  scale: 10,
  maxPixels: 1e10
});

Export.image.toDrive({
  image: image,
  description: 'split_9',
  scale: 10,
  region: aoi_buffered,
  folder: 'GEE_downloads/RandomForestModel/Data',
  crs: 'EPSG:4326',
  fileFormat: 'TFRecord',
  maxPixels: 1e10,
  formatOptions: {
    patchDimensions: [100, 100],
  }
});
