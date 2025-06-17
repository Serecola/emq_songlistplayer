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
    
    let tempData = [];
    let songNumber = 1;
    let songsArray = Object.values(importData);
    
    for (let songData of songsArray) {
        if (!songData.Song) continue;
        
        let song = songData.Song;
        
        // Get song type from Sources[0].MusicIds or Sources[0].SongTypes
        let songType = "Unknown";
        if (song.Sources && song.Sources.length > 0) {
            const source = song.Sources[0];
            if (source.MusicIds && source.MusicIds[song.Id]) {
                songType = source.MusicIds[song.Id][0];
            } 
            else if (source.SongTypes && source.SongTypes.length > 0) {
                songType = source.SongTypes[0];
            }
        }
        
        // Get English and Romaji titles
        let englishTitle = song.Sources[0].Titles.find(t => t.Language === "en")?.LatinTitle || "";
        let romajiTitle = song.Sources[0].Titles.find(t => t.Language === "ja")?.LatinTitle || song.Sources[0].Titles[0].LatinTitle;
        
        let tempSong = {
            gameMode: "Standard",
            name: song.Titles[0].LatinTitle,
            artist: song.Artists
                .filter(a => a.Roles && a.Roles.includes("Vocals"))
                .map(a => a.Titles[0].LatinTitle)
                .join(", "),
            visualnovel: {
                english: englishTitle,
                romaji: romajiTitle
            },
            songNumber: songNumber++,
            type: songType,
            urls: {}, // Will store both video and audio links
            activePlayers: 1,
            totalPlayers: 1,
            players: [],
            fromList: [],
            correctCount: songData.TimesCorrect || 0,
            videoLength: 0,
            startSample: 0,
            // Store all Self links for display
            links: []
        };

        // Process links - find all Self links and store them
        if (song.Links && song.Links.length) {
            // Store all Self links for display
            tempSong.links = song.Links.filter(link => link.Type === "Self" && link.IsFileLink);
            
            // Find shortest video and audio links for playback
            let videoLinks = tempSong.links.filter(link => link.IsVideo);
            let audioLinks = tempSong.links.filter(link => !link.IsVideo);
            
            if (videoLinks.length > 0) {
                let shortestVideo = videoLinks.reduce((prev, current) => 
                    parseDuration(prev.Duration) < parseDuration(current.Duration) ? prev : current
                );
                tempSong.urls.video = shortestVideo.Url;
                tempSong.videoLength = parseDuration(shortestVideo.Duration);
            }
            
            if (audioLinks.length > 0) {
                let shortestAudio = audioLinks.reduce((prev, current) => 
                    parseDuration(prev.Duration) < parseDuration(current.Duration) ? prev : current
                );
                tempSong.urls.audio = shortestAudio.Url;
                // Only set videoLength from video if available, otherwise use audio
                if (!tempSong.videoLength) {
                    tempSong.videoLength = parseDuration(shortestAudio.Duration);
                }
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
                        score: 0,
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