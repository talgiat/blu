
/**
 * Module dependencies.
 */

var csv = require('csv');
var express = require('express');
var app = express.createServer();

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

app.get('/stats/:suffix', function(req, res){
  var labels = {},
      years = {};
  csv()
  .fromPath(__dirname + '/my_discogs_' + req.params.suffix + '.csv', { columns: true })
  .on('data', function(data,index) {
		var year = parseInt(data.Released),
		    label = data.Label;
		// Year set
		if (isNaN(year)) {
		  year = -1;
		}
		years[year] = (years[year] || 0) + 1;
		// Label set
		labelSplit = label.split(',');
		if (labelSplit.length > 1 && labelSplit[0].trim() === labelSplit[1].trim()) {
		  label = labelSplit[0].trim();
		}
		labels[label] = (labels[label] || 0) + 1;
    		
  })
	.on('error', function(error) { 
		res.end("ERROR: " + error.message + '\n');		
	})
	.on('end', function (count) {
		var propName, i, year, decade,
		    maxLabelsToPrint = 10, 
		    finalLabels = [],
		    finalYears = []
		    decades = {},
		    finalDecades = [];

    // Lables
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
    res.write('By Years\n');
    res.write('=======================\n');
  	for (i = 0; i < finalYears.length; i++) {
  	  year = finalYears[i].year > 0 ? finalYears[i].year : 'unknown';
      decade = finalYears[i].year;
      decade = Math.floor((decade)/10) * 10;
      decades[decade] = (decades[decade] || 0) + finalYears[i].count;
      res.write((finalYears[i].year > 0 ? finalYears[i].year : 'unknown') + ' : ' + finalYears[i].count + '\n');
    }
    res.write('\n');
    
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
    res.end();
	});
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
