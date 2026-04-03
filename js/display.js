var cursong = -1;
var prevsong;

function loadData() {
    playerNames.clear();
    $("#slPlayerList > option").remove();
    $("#slTableContainer").show();
    $("#slTable").show();
    $("#slScoreboard").show();
    $("#slInfo").show();
    clearInfo();
    clearScoreboard();
    $("tr.songData, tr.quizSeparator").remove();
    let songid = 0;
    let lastQuizIndex = -1;
    let quizCounter = 0;
    for (let song of importData) {
        // Insert a separator row when the quiz changes
        let songQuizIndex = song.quizIndex !== undefined ? song.quizIndex : 0;
        if (songQuizIndex !== lastQuizIndex) {
            lastQuizIndex = songQuizIndex;
            quizCounter++;
            let boundary = importData.quizBoundaries && importData.quizBoundaries.find(b => b.quizIndex === songQuizIndex);
            let dateStr = boundary && boundary.createdAt
                ? new Date(boundary.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : ('Quiz ' + quizCounter);
            let sepQuizIndex = songQuizIndex;
            $("#slTable").append(
                $("<tr></tr>")
                    .addClass("quizSeparator clickable")
                    .attr("data-quiz-index", sepQuizIndex)
                    .append(
                        $("<td></td>").attr("colspan", "7")
                            .html("<span class='quizCollapseIcon'>&#9660;</span> Quiz " + quizCounter + "  ·  " + dateStr)
                    )
                    .click(function() {
                        let qi = $(this).data("quiz-index");
                        let isCollapsed = $(this).hasClass("collapsed");
                        $(this).toggleClass("collapsed");
                        $("tr.songData[data-quiz-index='" + qi + "']").each(function() {
                            if (isCollapsed) {
                                // Re-show only if not hidden by other filters
                                $(this).data("quiz-collapsed", false);
                                // Let updateRow decide visibility based on rowHidden cells
                                let hasHidden = $(this).find(".rowHidden").length > 0;
                                if (!hasHidden) $(this).show();
                            } else {
                                $(this).data("quiz-collapsed", true);
                                $(this).hide();
                            }
                        });
                        rebuildplaylist();
                    })
            );
        }

        let guesses = song.players.filter((tmpPlayer) => tmpPlayer.correct === true);
        let guessesCount = guesses.length;
        if (song.correctCount) guessesCount = song.correctCount;
        $("#slTable").append($("<tr id=" + songid + "></tr>")
            .addClass("songData")
            .addClass("clickable")
            .attr("data-quiz-index", songQuizIndex)
            .append($("<td></td>")
                .text(song.songNumber)
                .addClass("songNumber")
            )
            .append($("<td></td>")
                .text(song.name)
                .addClass("songName")
            )
            .append($("<td></td>")
                .text(song.artist)
                .addClass("songArtist")
            )
            .append($("<td></td>")
                .text(song.visualnovel.romaji)
                .addClass("vnNameRomaji")
            )
            .append($("<td></td>")
                .text(song.type)
                .addClass("songType")
            )
            .append($("<td></td>")
                .text("...")
                .addClass("playerAnswer")
            )
            .append($("<td></td>")
                .text(guessesCount + "/" + song.activePlayers + " (" + parseFloat((guessesCount / song.activePlayers * 100).toFixed(2)) + "%)")
                .addClass("guessesCounter")
            )
            .click(function () {
                if (!$(this).hasClass("selected")) {
                    $(".selected").removeClass("selected");
                    $(this).addClass("selected");
                    // Update guess type dropdown if this song belongs to a different quiz
                    updateGuessTypeDropdown(song.quizIndex !== undefined ? song.quizIndex : 0);
                    updateTableGuesses($("#slPlayerName").val());
                    updateScoreboard(song);
                    updateInfo(song);
                    repeat = repeatcount = $("#slRepeat").val() * 1;
                    repeatcount--;
                }
                else {
                    $(".selected").removeClass("selected");
                    clearScoreboard();
                    clearInfo();
                    stopsong();
                }
            })
            .hover(function () {
                $(this).addClass("hover");
            }, function () {
                $(this).removeClass("hover")
            })

        );
        $(".vnNameRomaji").show();
        song.players.forEach((player) => {
            playerNames.add(player.name);
        });
        song.songid = songid;
        songid++;
    }
    playerNames.forEach((p1, p2) => {
        $("#slPlayerList").append($("<option></option>")
            .attr("value", p1)
        );
    });
    $(".playerAnswer").hide();
    // Initialize guess type dropdown for the first quiz
    if (importData.quizBoundaries && importData.quizBoundaries.length > 0) {
        updateGuessTypeDropdown(importData.quizBoundaries[0].quizIndex);
    }
    updateTableGuesses($("#slPlayerName").val());
    updateScoreboardHighlight($("#slPlayerName").val());
}

function formatSamplePoint(start, length) {
    if (isNaN(start) || isNaN(length)) {
        return "Video not loaded";
    }
    let startPoint = Math.floor(start / 60) + ":" + (start % 60 < 10 ? "0" + (start % 60) : start % 60);
    let videoLength = Math.round(length);
    let totalLength = Math.floor(videoLength / 60) + ":" + (videoLength % 60 < 10 ? "0" + (videoLength % 60) : videoLength % 60);
    return startPoint + "/" + totalLength;
}

function getAnswerForType(player, guessType) {
    if (!player.answer || typeof player.answer !== 'object') return player.answer || "...";
    if (!guessType) {
        return Object.entries(player.answer)
            .map(([type, g]) => `[${type}] ${g.guess}`)
            .join(", ");
    }
    let entry = player.answer[guessType];
    return entry ? entry.guess : "—";
}

function isCorrectForType(player, guessType) {
    if (!player.answer || typeof player.answer !== 'object') return player.correct;
    if (!guessType) return player.correct;
    let entry = player.answer[guessType];
    return entry ? entry.correct : false;
}

function updateTableGuesses(playerName) {
    let guessType = $("#slGuessType").val() || 'Mst';
    let playerExists = false;
    for (let i = 0; i < importData.length; i++) {
        let findPlayer = importData[i].players.find((player) => {
            return player.name === playerName;
        });
        let $row = $($("tr.songData").get(i));
        let $answerCell = $($(".songData .playerAnswer").get(i));
        if (findPlayer !== undefined) {
            playerExists = true;
            $answerCell.text(getAnswerForType(findPlayer, guessType));
            $answerCell.removeClass("rowHidden");
            $(".playerAnswer").show();

            if (findPlayer.active === true) {
                let isCorrect = isCorrectForType(findPlayer, guessType);
                $row.removeClass("rightAnswerTable wrongAnswerTable");
                $row.addClass(isCorrect ? "rightAnswerTable" : "wrongAnswerTable");
            }
            else {
                $row.removeClass("rightAnswerTable wrongAnswerTable");
            }
        }
        else {
            $row.removeClass("rightAnswerTable wrongAnswerTable");
            $answerCell.text("...");
            if (!playerExists) {
                $(".playerAnswer").hide();
            }
            // If a player is selected but didn't participate in this song, hide the row
            if (playerName && playerName.trim() !== "") {
                $answerCell.addClass("rowHidden");
            } else {
                $answerCell.removeClass("rowHidden");
            }
        }
        updateRow($row);
    }
    rebuildplaylist();
}

// Friendly display names for known guess type codes
const GUESS_TYPE_LABELS = {
    'Mst': 'Visual Novel',
    'A': 'Artist',
    'Mt': 'Song Name',
    'Composer': 'Composer',
    'Developer': 'Developer',
};

function updateGuessTypeDropdown(quizIndex) {
    if (!importData || !importData.quizBoundaries) return;
    let boundary = importData.quizBoundaries.find(b => b.quizIndex === quizIndex);
    if (!boundary) return;

    let types = boundary.guessTypes || [];
    let $select = $("#slGuessType");
    let current = $select.val();

    $select.empty();
    for (let type of types) {
        let label = GUESS_TYPE_LABELS[type] || type;
        $select.append($("<option></option>").val(type).text(label));
    }

    // Restore selection if still available, otherwise default to 'Mst'
    if (current && types.includes(current)) {
        $select.val(current);
    } else {
        $select.val(types.includes('Mst') ? 'Mst' : (types[0] || 'Mst'));
    }
}

function updateScoreboard(selectedSong) {
    if (!importData || !selectedSong) return;

    let container = document.getElementById('slScoreboardContainer');
    container.innerHTML = '';

    let progressiveScores = {};
    let selectedSongIndex = selectedSong.songid;
    let targetQuiz = selectedSong.quizIndex !== undefined ? selectedSong.quizIndex : 0;

    for (let i = 0; i <= selectedSongIndex; i++) {
        let song = importData[i];
        if (!song) continue;
        // Only count songs from the same quiz
        if ((song.quizIndex !== undefined ? song.quizIndex : 0) !== targetQuiz) continue;

        song.players.forEach(player => {
            if (!progressiveScores[player.name]) {
                progressiveScores[player.name] = { correct: 0, total: 0 };
            }
            let correct = (player.categoryCorrect !== undefined) ? player.categoryCorrect : (player.correct ? 1 : 0);
            let total = (player.categoryTotal !== undefined) ? player.categoryTotal : 1;
            progressiveScores[player.name].correct += correct;
            progressiveScores[player.name].total += total;
        });
    }

    // Get the current song's player results for per-song correctness
    let currentSongPlayers = {};
    selectedSong.players.forEach(player => {
        let correct = (player.categoryCorrect !== undefined) ? player.categoryCorrect : (player.correct ? 1 : 0);
        currentSongPlayers[player.name] = correct;
    });

    let scores = Object.entries(progressiveScores)
        .map(([name, stats]) => ({ name, correct: stats.correct, total: stats.total }))
        .sort((a, b) => b.correct - a.correct);

    scores.forEach((player, index) => {
        let entry = document.createElement('div');
        entry.className = 'slScoreboardEntry';

        let position = document.createElement('span');
        position.className = 'slScoreboardPosition';
        position.textContent = `${index + 1}.`;

        let score = document.createElement('span');
        score.className = 'slScoreboardScore';
        let songCorrect = currentSongPlayers[player.name] || 0;
        if (songCorrect > 0) {
            score.classList.add('hasScore');
            score.textContent = `${player.correct}`;
        } else {
            score.classList.add('noScore');
            score.textContent = `${player.correct}`;
        }

        let name = document.createElement('span');
        name.className = 'slScoreboardName';
        name.textContent = player.name;

        entry.appendChild(position);
        entry.appendChild(score);
        entry.appendChild(name);
        container.appendChild(entry);
    });
}

function updateScoreboardHighlight(playerName) {
    document.querySelectorAll('.slScoreboardEntry').forEach(entry => {
        entry.classList.remove('highlight');
        if (entry.querySelector('.slScoreboardName').textContent === playerName) {
            entry.classList.add('highlight');
        }
    });
}

function updateInfo(song) {
    var cursongdata = song;
    cursong = song.songid;
    $("#slInfoHeader").children().remove();
    if ($("#slPlayOrder").val() === "random") {
        $("#slInfoHeader").append("<h2>Previous Song Info</h2>");
        if (prevsong !== undefined) song = importData[prevsong];
        else song = undefined;
        prevsong = cursong;
    }
    else {
        $("#slInfoHeader").append("<h2>Song Info</h2>");
        prevsong = undefined;
    }
    stopsong();
    clearInfo();
    if (song !== undefined) {
        let infoRow1 = $("<div></div>")
            .attr("class", "slInfoRow");
        let infoRow2 = $("<div></div>")
            .attr("class", "slInfoRow");
        let infoRow3 = $("<div></div>")
            .attr("class", "slInfoRow");
        let infoRow4 = $("<div></div>")
            .attr("class", "slInfoRow");

        let correctGuesses = song.correctCount || song.players.filter((tmpPlayer) => tmpPlayer.correct === true).length;
		let totalPlayers = song.activePlayers;
		let guessedPercentage = totalPlayers > 0 ? parseFloat((correctGuesses / totalPlayers * 100).toFixed(2)) : 0;

		let guesses = song.players.filter(player => player.correct === true);

		// Build running totals up to this song for "Name total (+perSong)" display
		// Scoped to the same quiz so scores reset per quiz
		let runningTotals = {};
		let songQuizIndex = song.quizIndex !== undefined ? song.quizIndex : 0;
		for (let i = 0; i <= song.songid; i++) {
			let s = importData[i];
			if (!s) continue;
			if ((s.quizIndex !== undefined ? s.quizIndex : 0) !== songQuizIndex) continue;
			s.players.forEach(p => {
				if (!runningTotals[p.name]) runningTotals[p.name] = 0;
				runningTotals[p.name] += (p.categoryCorrect !== undefined ? p.categoryCorrect : (p.correct ? 1 : 0));
			});
		}
		function formatGuessedEntry(player) {
			let total = runningTotals[player.name] || 0;
			let perSong = player.categoryCorrect !== undefined ? player.categoryCorrect : (player.correct ? 1 : 0);
			return player.name + " " + total + " (+" + perSong + ")";
		}

        let infoSongName = $("<div></div>")
            .attr("id", "slInfoSongName")
            .html("<h5><b>Song Name</b></h5><p>" + song.name + "</p>");
        let infoArtist = $("<div></div>")
            .attr("id", "slInfoArtist")
            .html("<h5><b>Artist</b></h5><p>" + song.artist + "</p>");
        let infoVNEnglish = $("<div></div>")
            .attr("id", "slInfoVNEnglish")
            .html("<h5><b>VN English</b></h5><p>" + song.visualnovel.english + "</p>");
        let infoVNRomaji = $("<div></div>")
            .attr("id", "slInfoVNRomaji")
            .html("<h5><b>VN Romaji</b></h5><p>" + song.visualnovel.romaji + "</p>");
        let infoType = $("<div></div>")
            .attr("id", "slInfoType")
            .html("<h5><b>Type</b></h5><p>" + song.type + "</p>");
        let infoGuessed = $("<div></div>")
			.attr("id", "slInfoGuessed")
			.html("<h5><b>Guessed<br>" + correctGuesses + "/" + totalPlayers + " (" + guessedPercentage + "%)</b></h5>");
        let infoFromList = $("<div></div>")
            .attr("id", "slInfoFromList")
            .html("<h5><b>From Lists<br>" + song.fromList.length + "/" + song.totalPlayers + " (" + parseFloat((song.fromList.length / song.totalPlayers * 100).toFixed(2)) + "%)</b></h5>");
        let infoUrls = $("<div></div>")
            .attr("id", "slInfoUrls")
            .html("<h5><b>URLs</b></h5>");

        infoRow1.append(infoSongName);
        infoRow1.append(infoArtist);
        infoRow1.append(infoType);

        infoRow2.append(infoVNEnglish);
        infoRow2.append(infoVNRomaji);

        infoRow3.append(infoUrls);

        infoRow4.append(infoGuessed);
        infoRow4.append(infoFromList);

        let infoListContainer;
        if (song.fromList.length === 0) {
			infoGuessed.css("width", "98%");
			infoFromList.hide();
			if (guesses.length > 1) {
				let infoGuessedLeft = $("<ul></ul>")
					.attr("id", "slInfoGuessedLeft");
				let infoGuessedRight = $("<ul></ul>")
					.attr("id", "slInfoGuessedRight");
				let i = 0;
				for (let guessed of guesses) {
					if (i++ % 2 === 0) {
						infoGuessedLeft.append($("<li></li>")
							.text(formatGuessedEntry(guessed))
						);
					}
					else {
						infoGuessedRight.append($("<li></li>")
							.text(formatGuessedEntry(guessed))
						);
					}
				}
				infoGuessed.append(infoGuessedLeft);
				infoGuessed.append(infoGuessedRight);
			}
			else if (guesses.length > 0) {
				infoListContainer = $("<ul></ul>")
					.attr("id", "slInfoGuessedList");
				for (let guessed of guesses) {
					infoListContainer.append($("<li></li>")
						.text(formatGuessedEntry(guessed))
					);
				}
				infoGuessed.append(infoListContainer);
			}
		}
        else {
            infoGuessed.css("width", "");
            infoListContainer = $("<ul></ul>")
                .attr("id", "slInfoGuessedList");
            infoFromList.show();
            for (let guessed of guesses) {
                infoListContainer.append($("<li></li>")
                    .text(formatGuessedEntry(guessed))
                );
            }
            infoGuessed.append(infoListContainer);
        }

        infoListContainer = $("<ul></ul>");
        for (let playerName of song.fromList) {
            infoListContainer.append($("<li></li>").text(playerName));
        }
        infoFromList.append(infoListContainer);

		// Updated URL display section
		infoListContainer = $("<ul></ul>").attr("id", "slInfoUrlList");

		function parseDuration(durationStr) {
			if (!durationStr) return 0;
			const parts = durationStr.split(':');
			if (parts.length >= 3) {
				const hh = parseInt(parts[0]) || 0;
				const mm = parseInt(parts[1]) || 0;
				const ss = parseFloat(parts[2]) || 0;
				return hh * 3600 + mm * 60 + ss;
			}
			return 0;
		}

		function formatDuration(durationStr) {
			if (!durationStr) return "";
			const parts = durationStr.split(':');
			if (parts.length >= 3) {
				const seconds = parts[2].split('.')[0];
				return `${parts[1]}:${seconds.padStart(2, '0')}`;
			}
			return durationStr;
		}

		if (song.links && song.links.length > 0) {
			const videoLinks = song.links.filter(link => link.IsVideo);
			const shortestVideo = videoLinks.reduce((shortest, current) => {
				return parseDuration(current.Duration) < parseDuration(shortest.Duration) ? current : shortest;
			}, videoLinks[0]);

			const audioLinks = song.links.filter(link => !link.IsVideo);
			const shortestAudio = audioLinks.reduce((shortest, current) => {
				return parseDuration(current.Duration) < parseDuration(shortest.Duration) ? current : shortest;
			}, audioLinks[0]);

			if (shortestVideo) {
				infoListContainer.append(
					$("<li></li>").append(
						$("<span></span>").text("Video: "),
						$("<a></a>")
							.attr("href", shortestVideo.Url)
							.attr("target", "_blank")
							.text(shortestVideo.Url),
						$("<span></span>").text(` (${formatDuration(shortestVideo.Duration)})`)
					)
				);
			}

			if (shortestAudio) {
				infoListContainer.append(
					$("<li></li>").append(
						$("<span></span>").text("Audio: "),
						$("<a></a>")
							.attr("href", shortestAudio.Url)
							.attr("target", "_blank")
							.text(shortestAudio.Url),
						$("<span></span>").text(` (${formatDuration(shortestAudio.Duration)})`)
					)
				);
			}

			if (!shortestVideo && !shortestAudio) {
				infoListContainer.append(
					$("<li></li>").text("No media links available")
				);
			}
		} else {
			infoListContainer.append(
				$("<li></li>").text("No media links available")
			);
		}
		infoUrls.append(infoListContainer);

        $("#slInfoBody").append(infoRow1);
        $("#slInfoBody").append(infoRow2);
        $("#slInfoBody").append(infoRow3);
        $("#slInfoBody").append(infoRow4);
    }
    song = cursongdata;

    var length = parseInt($("#slLength").val());

    const autoplayEnabled = $("#slAutoPlay").val() === "on";
    if (autoplayEnabled) {
    // Find all audio links
    const audioLinks = song.links.filter(link => !link.IsVideo);
		
		if (audioLinks.length > 0) {
			// Find the shortest audio link
			const shortestAudio = audioLinks.reduce((shortest, current) => {
				const shortestDuration = parseDuration(shortest.Duration);
				const currentDuration = parseDuration(current.Duration);
				return currentDuration < shortestDuration ? current : shortest;
			});
			
			var length = parseInt($("#slLength").val());
			var starttime = 0;
			if ($("#slSample").val() === "random") {
				starttime = Math.random() * (parseDuration(shortestAudio.Duration) - length - 5);
				if (starttime < 0) starttime = 0;
			} else if ($("#slSample").val() === "start") {
				starttime = 0.2;
			} else if ($("#slSample").val() === "mid") {
				starttime = (parseDuration(shortestAudio.Duration) - length) * 0.5;
			} else if ($("#slSample").val() === "end") {
				starttime = parseDuration(shortestAudio.Duration) - length - 5;
			}
			if (starttime < 0) starttime = 0;
			
			play(shortestAudio.Url, starttime);
		} else {
			for (let res of reslist) {
				for (let host of hostlist) {
					if (song.urls[host] !== undefined) {
						if (song.urls[host][res] !== undefined) {
							var starttime = 0;
							if ($("#slSample").val() === "random") starttime = Math.random() * (song.videoLength - length - 5);
							else if ($("#slSample").val() === "start") starttime = .2;
							else if ($("#slSample").val() === "mid") starttime = (song.videoLength - length) * .5;
							else if ($("#slSample").val() === "end") starttime = song.videoLength - length - 5;
							if (starttime < 0) starttime = 0;
							play(song.urls[host][res], starttime);
							return;
						}
					}
				}
			}
		}
	}
}
var nextsongtimer = null;

function clearInfo() {
    $("#slInfoBody").children().remove();
}

function clearScoreboard() {
    $(".slScoreboardEntry").remove();
}

function formatUrl(src) {
    return src ? "https://" + $("#slHost").val() + "/" + (src.replace(/^.*\//, '')) : src;
}

let currentAudio = null;

function play(url, starttime) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    currentAudio = document.getElementById('videoPlayer');
    currentAudio.src = url;
    currentAudio.currentTime = starttime;
    
    const playPromise = currentAudio.play();
    updatePlayPauseBtn();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error("Playback failed:", error);
            if (url.includes('.mp3') || url.includes('.weba')) {
                const videoLinks = song.links.filter(link => link.IsVideo);
                if (videoLinks.length > 0) {
                    const shortestVideo = videoLinks.reduce((shortest, current) => 
                        parseDuration(shortest.Duration) < parseDuration(current.Duration) ? shortest : current
                    );
                    play(shortestVideo.Url, starttime);
                }
            }
        });
    }
}


let repeat = 0;
var repeatcount = 0;
function updatePlayPauseBtn() {
    var videoPlayer = document.getElementById('videoPlayer');
    var paused = videoPlayer.paused || videoPlayer.src === '';
    if (paused) {
        $("#slPlayPauseBtn .play-icon").show();
        $("#slPlayPauseBtn .pause-icon").hide();
    } else {
        $("#slPlayPauseBtn .play-icon").hide();
        $("#slPlayPauseBtn .pause-icon").show();
    }
}

function togglePlayPause() {
    var videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer.paused) {
        if (videoPlayer.src) {
            videoPlayer.play();
        } else if (cursong >= 0) {
            playsong(cursong);
        } else if (playlist.length > 0) {
            playsong(playlist[0]);
        }
    } else {
        videoPlayer.pause();
    }
    updatePlayPauseBtn();
}

function playprevsong() {
    var index = playlist.findIndex((x) => x == cursong);
    var previndex;
    if (index > 0) previndex = playlist[index - 1];
    else previndex = playlist[playlist.length - 1];
    playsong(previndex);
}

function playnextsong() {
    repeat = $("#slRepeat").val() * 1;
    var nextindex;
    if (repeat > 0 && repeatcount > 0) {
        var index = playlist.findIndex((x) => x == cursong);
        nextindex = playlist[index];
    }
    else if ($("#slPlayOrder").val() === "random") {
        nextindex = playlist[getRandomInt(playlist.length)];
        if (repeat > 0) repeatcount = repeat;
    }
    else {
        var index = playlist.findIndex((x) => x == cursong);
        if (index < playlist.length - 1) index++; else index = 0;
        nextindex = playlist[index];
        if (repeat > 0) repeatcount = repeat;
    }
    if (repeat > 0) repeatcount--;
    playsong(nextindex);
}
function stopsong() {
    var videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.pause();
    if (nextsongtimer != null) clearTimeout(nextsongtimer);
    nextsongtimer = null;
    updatePlayPauseBtn();
}

function playsong(index) {
    $(".selected").removeClass("selected");
    $($("tr.songData").get(index)).addClass("selected");
    $("#slTableBody").scrollTop($(".songData.selected").position().top);
    updateScoreboard(importData[index]);
    updateInfo(importData[index]);
}
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}