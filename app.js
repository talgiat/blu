
/**
 * Module dependencies.
 */

var csv = require('csv');
var express = require('express');
var formidable = require('formidable');
var form = require('connect-form');
var fs = require('fs');
var request = require('request');
var jsdom = require('jsdom').jsdom;

//var ZIP = require("zip");

var app = express.createServer(
	form({ keepExtensions: true })
);

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Bacon Loving Unicorns will visualize your discogs collection'
  });
});

app.get('/stats/:userId', function(req,res) {
  var parseCollectionPages = parseCollectionPagesMaker(req.params.userId,res);
  parseCollectionPages.parse();
  res.end('fecthing for ' + req.params.userId);
})

app.get('/fromCSV', function(req, res){
  res.render('form', {
    title: 'Bacon Loving Unicorns will visualize your discogs collection'
  });
});

app.post('/fromCSV', function(req, res, next) {
  req.form.complete(function(err, fields, files){
    if (err) {
      next(err);
    } else {
	  var file = files.file;
      console.log('Uploaded %s to %s', file.filename, file.path);
      if (file.type === 'text/csv') {
      	parseDiscogsCSV(file.path,res);
	  } else {
		next(new Error("File type must be csv"))
	  }	
    }
  });

  req.form.on('progress', function(bytesReceived, bytesExpected){
    var percent = (bytesReceived / bytesExpected * 100) | 0;
    console.log('Uploading: %d%', percent);
  });
});

function parseDiscogsCSV(filename, res) {
  var labels = {},
      years = {};
  csv()
  .fromPath(filename, { columns: true })
  .on('data', function(data,index) {
	  addYearStats(data.Released,years);
	  addLabelStats(data.Label.split(',')[0],labels);
  })
  .on('error', function(error) { 
	  res.end("ERROR: " + error.message + '\n');		
  })
  .on('end', function (count) {
	  outputStats(labels,years,res);
  });
};

function outputStats(labels,years,res) {
  var propName, i, year, decade,
		  maxLabelsToPrint = 10, 
		  finalLabels = [],
		  finalYears = []
		  decades = {},
		  finalDecades = [];

  // Labels
  for (propName in labels) {
    if (typeof labels[propName] !== 'function' && labels.hasOwnProperty(propName)) {
	    finalLabels.push( { label : propName , count : labels[propName] } );	
    }
  }
  finalLabels.sort(function(a, b) {
    return b.count - a.count;
  });
  maxLabelsToPrint = Math.min(maxLabelsToPrint, finalLabels.length);
  res.write('Top Labels\n');
  res.write('=======================\n');
  for (i = 0; i < maxLabelsToPrint; i++) {
    res.write(finalLabels[i].label + ' : ' + finalLabels[i].count + '\n');
  }
  res.write('\n');
  
  // Years
  for (propName in years) {
    if (typeof years[propName] !== 'function' && years.hasOwnProperty(propName)) {
	    finalYears.push( { year : propName , count : years[propName] } );	
    }
  }
  finalYears.sort(function(a, b) {
    return a.year - b.year;
  });
  for (i = 0; i < finalYears.length; i++) {
	  year = finalYears[i].year > 0 ? finalYears[i].year : 'unknown';
    decade = finalYears[i].year;
    decade = Math.floor((decade)/10) * 10;
    decades[decade] = (decades[decade] || 0) + finalYears[i].count;
  }
  
  // Decades
  for (propName in decades) {
    if (typeof decades[propName] !== 'function' && decades.hasOwnProperty(propName)) {
	    finalDecades.push( { decade : propName , count : decades[propName] } );	
    }
  }
  finalDecades.sort(function(a, b) {
    return a.decade - b.decade;
  });
  res.write('By Decades\n');
    res.write('=======================\n');
    for (i = 0; i < finalDecades.length; i++) {
      decade = finalDecades[i].decade;
      if (decade > 0 ) {
        decade += 's';
      } else {
        decade = 'unknown';
      }
      res.write(decade   + ' : ' + finalDecades[i].count + '\n');
    }
  res.write('\n');

	// Print years
  res.write('By Years\n');
  res.write('=======================\n');
  for (i = 0; i < finalYears.length; i++) {
    res.write((finalYears[i].year > 0 ? finalYears[i].year : 'unknown') + ' : ' + finalYears[i].count + '\n');	
  }
  res.end();
}

function parseCollectionPagesMaker(userId,res) {
  var numOfPages = 0,
      encounteredError = false,
      RELEASE_INFO_INDEX = 2,
      RELEASE_YEAR_INDEX = 4;

  return {
    stats : { 
      labels : {},
      years : {},
      decades : {}
    },
    parse: function() {
      var that = this;
      parseUrl('http://www.discogs.com/collection?user=' + userId + '&sort=artist,asc&page=1', function(error, $) {
        if (error) {
          console.log('Couldn\'t parse first page for ' + userId);
          res.end('Collection for: ' + userId + ' is not public');
        } else {
          var last = $('.pagelink:last').text();
          if (last) {
            last = parseInt(last);
            numOfPages = last;
            for (var i=1; i <= last; i++) {
              that.parsePage(i);
            }
            console.log('Invoked for: ' + userId);
          } else {
            console.log('Couldn\'t parse first page for ' + userId);
            res.end('Collection for: ' + userId + ' is not public');
          }
        }
      },true);
    },
    parsePage: function(pageNum) {
      var that = this;
      parseUrl('http://www.discogs.com/collection?user=' + userId + '&sort=artist,asc&page=' + pageNum, function(error, $) {
        if (!encounteredError) {
          if (error) {
            encounteredError = true;
            res.end('Error fetching user collection');s
          } else {
            $('table.cw_public tr:gt(0) td').each(function(index) {
              var label = '',
                  year = '';
              switch (index % 6) {
               case RELEASE_INFO_INDEX:
                 label = $(this).find('a[href^="/label"]:first').text();
                  //.replace(/([\s]*\([\d]+\)$)/,'')); 
                 addLabelStats(label,that.stats.labels);
                 break;
               case RELEASE_YEAR_INDEX:
                 year = $(this).text();
                 addYearStats(year,that.stats.years);
                 break;
              }
            });
            numOfPages = numOfPages -1;
            console.log('Page left :' + numOfPages);
            if (numOfPages === 0) {
              console.log('Done for: ' + userId);
              outputStats(that.stats.labels,that.stats.years,res);
            } 
          }
        }  
      });
    }
  }
}

function parseUrl(url, callback, doit) {
  request( {
      uri : url,
      pool : { maxSockets: 2 }
    }, 
    function (error, response, body) {
      var options, window;
      if (!error && response.statusCode === 200) {
        options = { 
          features: {
            FetchExternalResources : false,
            ProcessExternalResources : false
          }
        };
        console.log(url)
        if (doit) {
          window = jsdom(body, null, options).createWindow();
          jsdom.jQueryify(window, __dirname + '/public/js/jquery-1.6.min.js', function (window, jquery) {
            callback(error,jquery);
          });
        }
      } else {
        error = error || "Not 200";
        callback(error,null);
      }
    }
  )
}

function addLabelStats(label,labels) {
	labels[label] = (labels[label] || 0) + 1;
}

function addYearStats(yearStr,years) {
  var year = parseInt(yearStr);
  if (isNaN(year)) {
    year = -1;
  }
  years[year] = (years[year] || 0) + 1;
}

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(9827);
  console.log("Express server listening on port %d", app.address().port);
}

// check directories 
fs.stat('/tmp', function(err,stats) {
  if (err) {
  	console.log(err);
    fs.mkdir('/tmp', '755', function(err) {
	  if (err) {
		console.log(err)
	  }
	});
  }
});
