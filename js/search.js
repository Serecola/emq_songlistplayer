const REGEX_REPLACE_RULES = [
    {
        input: 'ou',
        replace: '(ou|ō)'
    },
    {
        input: 'oo',
        replace: '(oo|ō)'
    },
    {
        input: 'o',
        replace: '[oōóòöôøΦ]'
    },
    {
        input: 'uu',
        replace: '(uu|ū)'
    },
    {
        input: 'u',
        replace: '[uūûúùüǖ]'
    },
    {
        input: 'a',
        replace: '[aä@âàáạåæā]'
    },
    {
        input: 'c',
        replace: '[cč]'
    },
    {
        input: ' ',
        replace: '([★☆\\/\\*=\\+·♥∽・〜†×♪→␣:;]* |(☆|★|\\/|\\*|=|\\+|·|♥|∽|・|〜|†|×|♪|→|␣|:|;)+)'
    },
    {
        input: 'e',
        replace: '[eéêëèæ]'
    },
    {
        input: '\'',
        replace: '[\'’]'
    },
    {
        input: 'n',
        replace: '[nñ]'
    },
    {
        input: '2',
        replace: '[2²]'
    },
    {
        input: 'i',
        replace: '[ií]'
    },
    {
        input: '3',
        replace: '[3³]'
    },
    {
        input: 'x',
        replace: '[x×]'
    },
    {
        input: 'b',
        replace: '[bß]'
    },
    {
        input: '\\\\-',
        replace: '[\\-–]'
    }
];

function escapeRegExp(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function createRegExp(query) {
    let escapedQuery = escapeRegExp(query);
    REGEX_REPLACE_RULES.forEach((rule) => {
        escapedQuery = escapedQuery.replace(new RegExp(rule.input, "gi"), rule.replace);
    });
    return new RegExp(escapedQuery, "i");
}

function testRegex(value, query) {
    return createRegExp(query).test(value);
}

function updateRow(row) {
    // Keep collapsed rows hidden regardless of filter state
    if (row.data("quiz-collapsed")) {
        row.hide();
        return;
    }
    if (row.find(".rowHidden").length === 0 || row.hasClass("rowHidden")) {
        row.show();
    }
    else {
        row.hide();
    }
}

function searchSongName(query) {
	var uncheckedcorrect=$("#slPlayerCorrect").hasClass("unchecked");
	var uncheckedincorrect=$("#slPlayerIncorrect").hasClass("unchecked");
	resetplaylist();
    $(".songData .songName").each((index, elem) => {
    	var rightanswer=$(elem).parent().hasClass("rightAnswerTable");
    	var wronganswer=$(elem).parent().hasClass("wrongAnswerTable");
    	if(uncheckedcorrect && rightanswer) {
    		$(elem).addClass("rowHidden");
    	}
    	else if(uncheckedincorrect && wronganswer) {
    		$(elem).addClass("rowHidden");
    	}
        else if (testRegex($(elem).text(), query)) {
            $(elem).removeClass("rowHidden");
            // playlist.push(index)
        }
        else {
            $(elem).addClass("rowHidden");
        }
        updateRow($(elem).parent());
    });
    rebuildplaylist();
}

function searchArtist(query) {
	var uncheckedcorrect=$("#slPlayerCorrect").hasClass("unchecked");
	var uncheckedincorrect=$("#slPlayerIncorrect").hasClass("unchecked");
	resetplaylist();
    $(".songData .songArtist").each((index, elem) => {
    	var rightanswer=$(elem).parent().hasClass("rightAnswerTable");
    	var wronganswer=$(elem).parent().hasClass("wrongAnswerTable");
    	if(uncheckedcorrect && rightanswer) {
    		$(elem).addClass("rowHidden");
    	}
    	else if(uncheckedincorrect && wronganswer) {
    		$(elem).addClass("rowHidden");
    	}
        else if (testRegex($(elem).text(), query)) {
            $(elem).removeClass("rowHidden");
            // playlist.push(index)
        }
        else {
            $(elem).addClass("rowHidden");
        }
        updateRow($(elem).parent());
    });
    rebuildplaylist();
}

function searchVN(query) {
	var except=false;
	if(query.startsWith('-')) {
		except=true;
		query=query.substr(1);
	}

	var uncheckedcorrect=$("#slPlayerCorrect").hasClass("unchecked");
	var uncheckedincorrect=$("#slPlayerIncorrect").hasClass("unchecked");
	resetplaylist();
    $(".songData .vnNameRomaji").each((index, elem) => {
    	var rightanswer=$(elem).parent().hasClass("rightAnswerTable");
    	var wronganswer=$(elem).parent().hasClass("wrongAnswerTable");

    	var matchromaji=testRegex($(elem).text(), query);
    	var matchenglish=testRegex($(elem).parent().find(".vnNameEnglish").text(), query);

    	if(uncheckedcorrect && rightanswer) {
    		$(elem).addClass("rowHidden");
    	}
    	else if(uncheckedincorrect && wronganswer) {
    		$(elem).addClass("rowHidden");
    	}
        else {
        	var hide=false;
        	if(except) {
        		if(matchromaji||matchenglish) hide=true;
        		else hide=false;
        	}
        	else {
        		if(matchromaji||matchenglish) hide=false;
        		else hide=true;
        	}
        	if(hide) {
        		$(elem).parent().find(".vnNameEnglish").removeClass("rowHidden");
        		$(elem).addClass("rowHidden");
        	}
        	else {
        		$(elem).removeClass("rowHidden");
        		$(elem).parent().find(".vnNameEnglish").removeClass("rowHidden");
        	}
        }
        updateRow($(elem).parent());
    });
    rebuildplaylist();
}

let playlist=[]
function resetplaylist() {
	playlist=[]
	stopsong();
}
function rebuildplaylist() {
	playlist=[]
	$(".songData").each((index, elem) => {
		if($(elem).css('display')!='none') playlist.push(index);
	});
}

function updateTypes() {
	resetplaylist();

	var uncheckedcorrect=$("#slPlayerCorrect").hasClass("unchecked");
	var uncheckedincorrect=$("#slPlayerIncorrect").hasClass("unchecked");

    $(".songData .songType").each((index, elem) => {
    	var rightanswer=$(elem).parent().hasClass("rightAnswerTable");
    	var wronganswer=$(elem).parent().hasClass("wrongAnswerTable");
    	if(uncheckedcorrect && rightanswer) {
    		$(elem).addClass("rowHidden");
    	}
    	else if(uncheckedincorrect && wronganswer) {
    		$(elem).addClass("rowHidden");
    	}
        else if ($(elem).text().includes("OP") && $("#slTypeOpenings").hasClass("unchecked")) {
            $(elem).addClass("rowHidden");
        }
        else if ($(elem).text().includes("OP") && !$("#slTypeOpenings").hasClass("unchecked")) {
            $(elem).removeClass("rowHidden");
            //playlist.push(index)
        }
        else if ($(elem).text().includes("ED") && $("#slTypeEndings").hasClass("unchecked")) {
            $(elem).addClass("rowHidden");
        }
        else if ($(elem).text().includes("ED") && !$("#slTypeEndings").hasClass("unchecked")) {
            $(elem).removeClass("rowHidden");
            //playlist.push(index)
        }
        else if ($(elem).text().includes("BGM") && $("#slTypeBGM").hasClass("unchecked")) {
            $(elem).addClass("rowHidden");
        }
        else if ($(elem).text().includes("BGM") && !$("#slTypeBGM").hasClass("unchecked")) {
            $(elem).removeClass("rowHidden");
            //playlist.push(index)
        }
                else if ($(elem).text().includes("Other") && $("#slTypeOther").hasClass("unchecked")) {
            $(elem).addClass("rowHidden");
        }
        else if ($(elem).text().includes("Other") && !$("#slTypeOther").hasClass("unchecked")) {
            $(elem).removeClass("rowHidden");
            //playlist.push(index)
        }
        else if ($(elem).text().includes("Insert") && $("#slTypeInserts").hasClass("unchecked")) {
            $(elem).addClass("rowHidden");
        }
        else {
            $(elem).removeClass("rowHidden");
            // playlist.push(index)
        }
        updateRow($(elem).parent())
    })
    rebuildplaylist();
}

let autoplay=true;
function updateAutoPlay() {
	autoplay=!$("#slAutoPlay").hasClass("unchecked");
}
