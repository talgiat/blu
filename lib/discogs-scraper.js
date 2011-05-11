var request = require('request');

// callback is called like this callback(error,stats)
// where error is error message if an error occurred, or null, and stats is collections statistics object

exports.scrape = function(userId,callback) {
  var PAGE_LINK_PATTERN = /(?:<a[\s]+[^>]*class="pagelink">)(?:[^<]*)/g,
      RELEASES_TABLE_PATTERN = /(?:<table[^>]*>)(?:.|\n|\r)*?(:?<\/table>)/g,
      RELEASES_TABLE_DATA_ITEMS = /(?:<td[^>]*>)(?:.|\n|\r)*?(:?<\/td>)/g,
      RELEASE_INFO_INDEX = 2,
      RELEASE_YEAR_INDEX = 4,
      MAX_CONCURRENT = 5,
      numOfPagesLeft = 0,
      nextPageToParse = 0,
      totalNumOfPages = 0,
      encounteredError = false,
      stats = { 
        labels : {},
        years : {},
        decades : {}
      };
      function reportError(error) {
        var errorMsg = 'Couldn\'t fetch collection for ' + userId + ', because : ' + error;
        console.log(errorMsg);
        callback(errorMsg);
      }
      
      function isValidRegexpResult(result) {
        return result && result.length > 0;
      }
      
      function fetchUrl(url, cb) {
        request( { uri : url, pool : { maxSockets: 2 } }, function (error, response, body) {
          if (!encounteredError) {
            if (!error && response.statusCode === 200) {
              console.log(url);
              cb(body);
            } else {
              error = error || { errno: -1, message: 'Not 200'};
              switch(error.errno) { // Friendly error messages 
                case 110: //timeout
                  error = "Discogs is down";
                  break;
                default:
                  error = error.message;
              }
              encounteredError = true;    
              reportError(error);
            }
          }  
        });
      }    
      
      function scrapePage(pageNum) {
        var releasesTable, releasesTableDataItems,
            labelItem, label, 
            yearItem, yearStartIndex, yearEndIndex, year, i;
            
        fetchUrl('http://www.discogs.com/collection?user=' + userId + '&sort=artist,asc&page=' + pageNum, function(body) {
          releasesTable = body.match(RELEASES_TABLE_PATTERN);
          encounteredError = !isValidRegexpResult(releasesTable);
          if (!encounteredError) {
            releasesTableDataItems = releasesTable[0].match(RELEASES_TABLE_DATA_ITEMS);
            encounteredError = !isValidRegexpResult(releasesTableDataItems);
            if (!encounteredError) {
              for (i = 0; i < releasesTableDataItems.length; i++) {
                switch (i % 6) {
                 case RELEASE_INFO_INDEX:
                   labelItem = releasesTableDataItems[i];
                   //console.log(label);  
                   //stats.labels[label] = (stats.labels[label] || 0) + 1;
                   break;
                 case RELEASE_YEAR_INDEX:
                   yearItem = releasesTableDataItems[i];
                   yearStartIndex = yearItem.indexOf('>') + 1;
                   yearEndIndex = yearItem.lastIndexOf('<');
                   year = yearItem.substring(yearStartIndex,yearEndIndex);
                   //console.log(year);
                   year = parseInt(year,10);
                   if (isNaN(year)) {
                     year = -1;
                   }
                   stats.years[year] = (stats.years[year] || 0) + 1;
                   break;
                }
              }
              numOfPagesLeft -= 1;
              //console.log(userId + ', pages left :' + numOfPagesLeft + ' ,heap used: ' + process.memoryUsage().heapUsed);
              if (nextPageToParse < totalNumOfPages) {
                nextPageToParse += 1;
                scrapePage(nextPageToParse);
              } else if (numOfPagesLeft === 0) {
                console.log(userId + ' ,done');
                callback(null,stats);
              }
            }  
          } 
        });
      }
      
  return (function() {
    var lastLink,
        lastPageNumIndex;

    fetchUrl('http://www.discogs.com/collection?user=' + userId, function(body) {
      var i, 
          parsingError = false,
          pageLinks = body.match(PAGE_LINK_PATTERN);
      
      if (isValidRegexpResult(pageLinks)) {
        lastLink = pageLinks[pageLinks.length-1];
        lastPageNumIndex = lastLink.indexOf('>') + 1;
        totalNumOfPages = parseInt(lastLink.substring(lastPageNumIndex),10);
        if (!isNaN(totalNumOfPages)) {
          //totalNumOfPages = 1;
          numOfPagesLeft = totalNumOfPages;
          nextPageToParse = Math.min(totalNumOfPages,MAX_CONCURRENT);
          for (i = 1; i <= nextPageToParse; i+=1) {
            scrapePage(i);
          }
          //console.log('Invoked for: ' + userId);
        } else {
          parsingError = true;
        }  
      } else {
        parsingError = true;
      }
      if (parsingError) {
        reportError('Collection for: ' + userId + ' is not public');
      }
    });
  }());
};