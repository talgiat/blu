var request = require('request');
var jsdom = require('jsdom').jsdom;

// callback is called like this callback(error,stats)
// where error is error message if an error occurred, or null, and stats is collections statistics object
exports.scrape = function(userId,callback) {
  scraperMaker(userId,callback).scrape();
}

function scraperMaker(userId,callback) {
  var numOfPagesLeft = 0,
      nextPageToParse = 0,
      totalNumOfPages = 0,
      encounteredError = false,
      RELEASE_INFO_INDEX = 2,
      RELEASE_YEAR_INDEX = 4,
      MAX_CONCURRENT_REQEUSTS = 5;

  return {
    callback : callback,
    stats : { 
      labels : {},
      years : {},
      decades : {}
    },
    scrape: function() {
      var that = this,
          errorMsg;
      parseUrl('http://www.discogs.com/collection?user=' + userId + '&sort=artist,asc&page=1', function(error, $) {
        if (error) {
          errorMsg = 'Couldn\'t fetch collection for ' + userId + ', because :' + error;
          console.log(errorMsg);
          that.callback(errorMsg);
        } else {
          var last = $('.pagelink:last').text();
          if (last) {
            last = parseInt(last);
            totalNumOfPages = last;
            numOfPagesLeft = totalNumOfPages;
            nextPageToParse = Math.min(last,MAX_CONCURRENT_REQEUSTS);
            for (var i = 1; i <= nextPageToParse; i+=1) {
              that.scrapePage(i);
            }
            console.log('Invoked for: ' + userId);
          } else {
            errorMsg = 'Collection for: ' + userId + ' is not public';
            console.log(errorMsg);
            that.callback(errorMsg);
          }
        }
      });
    },
    scrapePage: function(pageNum) {
      var that = this;
      parseUrl('http://www.discogs.com/collection?user=' + userId + '&sort=artist,asc&page=' + pageNum, function(error, $) {
        if (!encounteredError) {
          if (error) {
            encounteredError = true;
            that.callback('Error fetching user collection ' + error.toString());
          } else {
            $('table.cw_public tr:gt(0) td').each(function(index) {
              var label = '',
                  year = '';
              switch (index % 6) {
               case RELEASE_INFO_INDEX:
                 label = $(this).find('a[href^="/label"]:first').text();
                 that.stats.labels[label] = (that.stats.labels[label] || 0) + 1;
                 break;
               case RELEASE_YEAR_INDEX:
                 year = parseInt($(this).text());
                 if (isNaN(year)) {
                   year = -1;
                 }
                 that.stats.years[year] = (that.stats.years[year] || 0) + 1;
                 break;
              }
            });
            numOfPagesLeft -= 1;
            console.log(userId + ', pages left :' + numOfPagesLeft + ' ,heap used: ' + process.memoryUsage().heapUsed);
            if (nextPageToParse < totalNumOfPages) {
              nextPageToParse += 1;
              that.scrapePage(nextPageToParse);
            } else if (numOfPagesLeft === 0) {
              console.log(userId + ' ,done');
              that.callback(null,that.stats);
            } 
          }
        } 
      });
    }
  }
}

function parseUrl(url, callback) {
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
        window = jsdom(body, null, options).createWindow();
        jsdom.jQueryify(window, __dirname + '/../public/js/jquery-1.6.min.js', function (window, jquery) {
          callback(error,jquery);
        });
        
      } else {
        if (error) {
          switch(error.errno) {
            case 110: //timeout
              error = "Discogs is down";
              break;
            default:
              error = error.message;
          }    
        }
        error = error || "Not 200";
        callback(error,null);
      }
    }
  )
}
