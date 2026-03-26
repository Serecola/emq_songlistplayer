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
    $("#slAutoPlay").on("change", updateAutoPlay);
    $("#slGuessType").on("change", function() {
        updateTableGuesses($("#slPlayerName").val());
        updateTypes();
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

    // Handle new EMQ Room export format: { Room: {...}, Quizzes: [{Quiz, SongHistories, PlayerStats}] }
    // Each quiz is stored as a flat list of songs tagged with quizIndex so scores reset per quiz.
    let quizBoundaries = []; // [{start, end, createdAt}] indices into tempData
    let allSongEntries = []; // [{songData, quizIndex}]

    if (importData.Quizzes && Array.isArray(importData.Quizzes)) {
        // Sort quizzes oldest-first so song numbering goes chronologically
        let quizzes = [...importData.Quizzes].sort((a, b) =>
            new Date(a.Quiz.created_at) - new Date(b.Quiz.created_at)
        );
        for (let qi = 0; qi < quizzes.length; qi++) {
            let quiz = quizzes[qi];
            if (quiz.SongHistories) {
                for (let key of Object.keys(quiz.SongHistories)) {
                    allSongEntries.push({ songData: quiz.SongHistories[key], quizIndex: qi, createdAt: quiz.Quiz.created_at });
                }
            }
        }
    } else {
        // Legacy flat format
        for (let songData of Object.values(importData)) {
            allSongEntries.push({ songData, quizIndex: 0, createdAt: null });
        }
    }

    let tempData = [];
    let playerScores = {};
    let currentQuizIndex = -1;
    let songNumber = 1;

    for (let { songData, quizIndex, createdAt } of allSongEntries) {
        // Reset song counter when a new quiz starts
        if (quizIndex !== currentQuizIndex) {
            currentQuizIndex = quizIndex;
            songNumber = 1;
            // Mark the boundary for this quiz in tempData
            quizBoundaries.push({ quizIndex, start: tempData.length, createdAt });
        }
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
            quizIndex: quizIndex,
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
            urls: {},
            activePlayers: 0,   // filled after processing PlayerGuessInfos
            totalPlayers: songData.PlayerGuessInfos ? Object.keys(songData.PlayerGuessInfos).length : 0,
            players: [],
            fromList: [], // Now will just store names
            correctCount: 0,    // filled after processing PlayerGuessInfos
            videoLength: 0,
            startSample: 0,
            links: []
        };

        // Process links
        if (song.Links && song.Links.length) {
            tempSong.links = song.Links.filter(link => link.Type === "Self");
            
            let videoLinks = song.Links.filter(link => link.Type === "Self" && link.IsVideo);
            let audioLinks = song.Links.filter(link => link.Type === "Self" && !link.IsVideo);
            
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
                if (!tempSong.videoLength) {
                    tempSong.videoLength = parseDuration(shortestAudio.Duration);
                }
            }
        }

        if (songData.PlayerGuessInfos) {
            for (let playerId in songData.PlayerGuessInfos) {
                let playerGuesses = songData.PlayerGuessInfos[playerId];

                // Use Mst for display name/answer; fall back to first available category
                let primaryGuess = playerGuesses.Mst || Object.values(playerGuesses)[0];
                if (!primaryGuess) continue;
                let username = primaryGuess.Username;

                // Count correct across all guess categories (each category counts as 1)
                let categories = Object.values(playerGuesses);
                let categoryCorrect = categories.filter(g => g.IsGuessCorrect).length;
                let categoryTotal = categories.length;

                let scoreKey = quizIndex + ':' + username;
                if (!playerScores[scoreKey]) {
                    playerScores[scoreKey] = { correct: 0, total: 0, name: username, quizIndex };
                }
                playerScores[scoreKey].correct += categoryCorrect;
                playerScores[scoreKey].total += categoryTotal;

                // Store guesses per category for dynamic display
                let guessesMap = {};
                for (let [type, g] of Object.entries(playerGuesses)) {
                    guessesMap[type] = { guess: g.Guess || "", correct: g.IsGuessCorrect };
                }

                // Track available guess types for this quiz
                if (!tempSong._quizGuessTypes) tempSong._quizGuessTypes = new Set();
                for (let type of Object.keys(playerGuesses)) tempSong._quizGuessTypes.add(type);

                tempSong.players.push({
                    name: username,
                    answer: guessesMap,
                    correct: categoryCorrect > 0,
                    categoryCorrect: categoryCorrect,
                    categoryTotal: categoryTotal,
                    score: categoryCorrect,
                    position: 0,
                    positionSlot: 0,
                    active: true
                });

                if (primaryGuess.IsOnList) {
                    tempSong.fromList.push(username);
                }

                playerNames.add(username);
            }
        }

        // Set real totals from processed player data
        tempSong.correctCount = tempSong.players.reduce((sum, p) => sum + (p.categoryCorrect !== undefined ? p.categoryCorrect : (p.correct ? 1 : 0)), 0);
        tempSong.activePlayers = tempSong.players.reduce((sum, p) => sum + (p.categoryTotal !== undefined ? p.categoryTotal : 1), 0);

        // Collect guess types into the current quiz boundary
        if (tempSong._quizGuessTypes && quizBoundaries.length > 0) {
            let curBoundary = quizBoundaries[quizBoundaries.length - 1];
            if (!curBoundary.guessTypes) curBoundary.guessTypes = new Set();
            for (let t of tempSong._quizGuessTypes) curBoundary.guessTypes.add(t);
        }
        delete tempSong._quizGuessTypes;

        tempData.push(tempSong);
    }

    // Close the last quiz boundary; convert Sets to sorted Arrays
    const TYPE_ORDER = ['Mst', 'A', 'Mt', 'Composer', 'Developer'];
    for (let b of quizBoundaries) {
        b.end = tempData.length - 1;
        if (b.guessTypes) {
            b.guessTypes = [...b.guessTypes].sort((a, z) => {
                let ai = TYPE_ORDER.indexOf(a), zi = TYPE_ORDER.indexOf(z);
                if (ai === -1) ai = 99; if (zi === -1) zi = 99;
                return ai - zi;
            });
        } else {
            b.guessTypes = [];
        }
    }

    importData = tempData;
    importData.playerScores = playerScores;
    importData.quizBoundaries = quizBoundaries;
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

            $("#slPlayerName").val("");
            $('#slPlayerCorrect').removeClass('unchecked');
            $('#slPlayerIncorrect').removeClass('unchecked');
            playerNames.clear();
            importData = JSON.parse(reader.result);
            convertData();
            updateScoreboard();
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