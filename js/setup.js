let importData;
let playerNames = new Set();

function setup() {
    $("#slImportButton").click(function () {
        $("#slImport").trigger("click");
    });
    $("#slSearchSongName").on("input", function (event) {
        searchSongName($(this).val());
    });
    $("#slSearchArtist").on("input", function (event) {
        searchArtist($(this).val());
    });
    $("#slSearchVN").on("input", function (event) { 
        searchVN($(this).val());
    });
    $(".filterCheckbox").click(function () {
        if ($(this).hasClass("unchecked")) {
            $(this).removeClass("unchecked");
        }
        else {
            $(this).addClass("unchecked");
        }
        updateTypes();
        updateTableGuesses($("#slPlayerName").val());
    });
    $("#slVNTitleSelect").on("change", function () { 
        if ($(this).val() === "english") {
            $(".vnNameEnglish").show();
            $(".vnNameRomaji").hide();
        }
        else {
            $(".vnNameEnglish").hide();
            $(".vnNameRomaji").show();
        }
    });
    $(".autoplayCheckbox").click(function () {
        if ($(this).hasClass("unchecked")) {
            $(this).removeClass("unchecked");
        }
        else {
            $(this).addClass("unchecked");
        }
        updateAutoPlay();
    });
    $("#slPlayerName").on("input", function () {
        updateScoreboardHighlight($(this).val());
        updateTableGuesses($(this).val());
        updateTypes();
    });
    $("#slImport").on("change", function () {
        let file = $(this).get(0).files[0];
        if (!file) {
            alert("Please select a file");
        }
        else {
            openSongList(file);
        }
    })
    $("#slHeader")
        .on("dragover", dragOver)
        .on("dragleave", dragOver)
        .on("drop", uploadFiles)
        .on("wheel", volumeControl);
    $("#slMain")
        .on("dragover", dragOver)
        .on("dragleave", dragOver)
        .on("drop", uploadFiles);
    $("#slScoreboard")
        .on("wheel", volumeControl);
    $("#slInfo")
        .on("wheel", volumeControl);

    createVideoPlayer();
}

function dragOver(e){
    e.stopPropagation();
    e.preventDefault();
}
 
function uploadFiles(e){
    e.stopPropagation();
    e.preventDefault();
    dragOver(e);

    e.dataTransfer = e.originalEvent.dataTransfer;
    var files = e.target.files || e.dataTransfer.files;

    openSongList(files[0]);
}

function convertData() {
    if (!importData || typeof importData !== 'object') return;
    
    // Convert the EMQ export format to our internal format
    let tempData = [];
    let songNumber = 1;
    
    // EMQ export is an object with numeric keys, convert to array
    let songsArray = Object.values(importData);
    
    for (let songData of songsArray) {
        if (!songData.Song) continue;
        
        let song = songData.Song;
        let tempSong = {
            gameMode: "Standard",
            name: song.Titles[0].LatinTitle,
            artist: song.Artists
                .filter(a => a.Roles && a.Roles.includes("Vocals")) // Filter artists by 'Vocals' role
                .map(a => a.Titles[0].LatinTitle)
                .join(", "),
            visualnovel: {
                english: song.Sources[0].Titles.find(t => t.Language === "en")?.LatinTitle || "",
                romaji: song.Sources[0].Titles[0].LatinTitle
            },
            songNumber: songNumber++,
            type: song.Sources[0].SongTypes && song.Sources[0].SongTypes.length > 0 ? 
                song.Sources[0].SongTypes[0] : 
                (song.Sources[0].MusicIds && song.Sources[0].MusicIds[song.Id] ? 
                song.Sources[0].MusicIds[song.Id][0] : 
                "Unknown"),
            urls: {},
            activePlayers: 1,
            totalPlayers: 1,
            players: [],
            fromList: [],
            correctCount: songData.TimesCorrect || 0,
            videoLength: 0,
            startSample: 0
        };

        // Process links
        if (song.Links && song.Links.length) {
            for (let link of song.Links) {
                if (link.Type === "Catbox" || link.Type === "Self") {
                    if (link.IsVideo) {
                        tempSong.urls.catbox = tempSong.urls.catbox || {};
                        tempSong.urls.catbox["720"] = link.Url;
                    } else {
                        tempSong.urls.catbox = tempSong.urls.catbox || {};
                        tempSong.urls.catbox["0"] = link.Url;
                    }
                }
            }
        }

        // Get duration from the first link that has it
        if (song.Links && song.Links.length) {
            let linkWithDuration = song.Links.find(l => l.Duration);
            if (linkWithDuration) {
                tempSong.videoLength = parseDuration(linkWithDuration.Duration);
            }
        }

        // Process player guesses
        if (songData.PlayerGuessInfos) {
            for (let playerId in songData.PlayerGuessInfos) {
                let guessInfo = songData.PlayerGuessInfos[playerId].Mst;
                if (guessInfo) {
                    tempSong.players.push({
                        name: guessInfo.Username,
                        answer: guessInfo.Guess,
                        correct: guessInfo.IsGuessCorrect,
                        score: 0, // EMQ doesn't provide score in this export
                        position: 0,
                        positionSlot: 0,
                        active: true
                    });
                    playerNames.add(guessInfo.Username);
                }
            }
        }

        tempData.push(tempSong);
    }
    
    importData = tempData;
}

function parseDuration(durationStr) {
    // Parse duration like "00:03:34.8070000" into seconds
    if (!durationStr) return 0;
    
    let parts = durationStr.split(':');
    if (parts.length !== 3) return 0;
    
    let secondsParts = parts[2].split('.');
    let hours = parseInt(parts[0]) || 0;
    let minutes = parseInt(parts[1]) || 0;
    let seconds = parseInt(secondsParts[0]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
}

function openSongList(file) {
    let reader = new FileReader();
    reader.onload = function () {
        try {
            importData = JSON.parse(reader.result);
            convertData();
            $("#slInfo").hide();
            $("#slScoreboard").hide();
            loadData();
            searchVN($("#slSearchVN").val());
            searchArtist($("#slSearchArtist").val());
            searchSongName($("#slSearchSongName").val());
            updateTypes();
        }
        catch (e) {
            if (e instanceof SyntaxError) {
                alert(e.name + ": " + e.message);
            }
            if (e instanceof ReferenceError) {
                alert(e.name + ": " + e.message);
            }
        }
    }
    reader.readAsText(file);
}

// Remove the old convertJson and convertSong functions since we're handling conversion in convertData now

function createVideoPlayer() {
    var videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.onended = playnextsong;
    videoPlayer.onseeked = function() {
        if(videoPlayer.paused) return;
        if($("#slSample").val() !== "all") {
            var length = parseInt($("#slLength").val())*1000;
            nextsongtimer = setTimeout(function() { playnextsong() }, length);
        }
    }
    videoPlayer.volume = getCookie("volume", 1);
    return videoPlayer;
}

function volumeControl(event) {
    let videoPlayer = document.getElementById('videoPlayer');
    var volumetemp = videoPlayer.volume;
    volumetemp += (event.originalEvent.deltaY < 0) ? .05 : -.05;
    volumetemp = Math.min(Math.max(volumetemp, 0), 1);
    videoPlayer.volume = volumetemp;
    setCookie("volume", volumetemp);
}

function getCookie(cookieKey, defaultValue) {
    var cookieList = document.cookie.split(";");
    var tempValue = cookieList.find(function(cookie) {
        return cookie.includes(cookieKey);
    });

    if (tempValue == null) {
        return defaultValue;
    }

    var cookieValue = tempValue.substring(cookieKey.length + 2);
    return parseFloat(cookieValue);
}

function setCookie(cookieKey, value) {
    document.cookie = cookieKey + "=" + value.toString() + "; max-age=9999999";
}