// =====================================================
// EwanMusical.app
// MusicBrainz + YouTube
// =====================================================

const API = "https://musicbrainz.org/ws/2";

const searchInput = document.getElementById("searchInput");
const statusBox = document.getElementById("status");
const artistBox = document.getElementById("artist");
const resultsBox = document.getElementById("results");
const moreButton = document.getElementById("moreButton");

let currentArtist = null;
let currentOffset = 0;
let totalSongs = 0;
let isLoading = false;
let lastRequest = 0;


// =====================================================
// OUTILS
// =====================================================

function escapeHTML(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalize(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// =====================================================
// LIMITATION MUSICBRAINZ
// =====================================================

async function waitBeforeRequest() {

    const now = Date.now();
    const difference = now - lastRequest;

    if (difference < 1100) {
        await sleep(1100 - difference);
    }

    lastRequest = Date.now();
}


// =====================================================
// API MUSICBRAINZ
// =====================================================

async function apiFetch(url) {

    await waitBeforeRequest();

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(
            "Erreur MusicBrainz : " + response.status
        );
    }

    return await response.json();
}


// =====================================================
// STATUS
// =====================================================

function status(message) {

    if (statusBox) {
        statusBox.innerHTML = message;
    }
}


// =====================================================
// RECHERCHE ARTISTE
// =====================================================

async function searchArtist() {

    const text = searchInput.value.trim();

    if (!text) {
        status("⚠️ Écris le nom d'un artiste.");
        return;
    }

    if (isLoading) return;

    isLoading = true;

    currentArtist = null;
    currentOffset = 0;
    totalSongs = 0;

    artistBox.innerHTML = "";
    resultsBox.innerHTML = "";

    if (moreButton) {
        moreButton.style.display = "none";
    }

    status(
        "🔎 Recherche de <b>" +
        escapeHTML(text) +
        "</b>..."
    );

    try {

        const url =
            API +
            "/artist/?" +
            "query=" +
            encodeURIComponent("artist:" + text) +
            "&fmt=json" +
            "&limit=10";

        const data = await apiFetch(url);

        const artists = data.artists || [];

        if (artists.length === 0) {

            status(
                "❌ Aucun artiste trouvé pour <b>" +
                escapeHTML(text) +
                "</b>."
            );

            return;
        }


        const wanted = normalize(text);

        let artist = artists.find(
            a => normalize(a.name) === wanted
        );

        if (!artist) {
            artist = artists[0];
        }

        currentArtist = artist;

        showArtist(artist);

        status(
            "✅ Artiste trouvé : <b>" +
            escapeHTML(artist.name) +
            "</b><br>🎵 Chargement des chansons..."
        );

        // IMPORTANT
        isLoading = false;

        await loadSongs(true);

    } catch (error) {

        console.error(error);

        status(
            "❌ Impossible de contacter MusicBrainz.<br>" +
            "Vérifie ta connexion Internet."
        );

    } finally {

        isLoading = false;
    }
}


// =====================================================
// AFFICHER ARTISTE
// =====================================================

function showArtist(artist) {

    const type =
        artist.type || "Artiste";

    const country =
        artist.country ||
        (artist.area ? artist.area.name : "");

    artistBox.innerHTML = `
        <div class="artistBox">

            <div class="artistIcon">
                🎤
            </div>

            <div>

                <h2>
                    ${escapeHTML(artist.name)}
                </h2>

                <p>
                    ${escapeHTML(type)}
                    ${country
                        ? " • " + escapeHTML(country)
                        : ""}
                </p>

                <small>
                    Catalogue MusicBrainz
                </small>

            </div>

        </div>
    `;
}


// =====================================================
// CHARGER LES CHANSONS
// =====================================================

async function loadSongs(reset = false) {

    if (!currentArtist || isLoading) {
        return;
    }

    isLoading = true;

    if (reset) {

        currentOffset = 0;
        totalSongs = 0;

        resultsBox.innerHTML = "";

        if (moreButton) {
            moreButton.style.display = "none";
        }
    }

    try {

        const url =
            API +
            "/recording/?" +
            "artist=" +
            encodeURIComponent(currentArtist.id) +
            "&fmt=json" +
            "&inc=artist-credits" +
            "&limit=100" +
            "&offset=" +
            currentOffset;

        const data = await apiFetch(url);

        const songs =
            data.recordings || [];

        totalSongs =
            Number(data.count || 0);


        if (songs.length === 0) {

            if (currentOffset === 0) {

                resultsBox.innerHTML = `
                    <div class="noResult">
                        ❌ Aucune chanson trouvée.
                    </div>
                `;

                status(
                    "⚠️ Aucune chanson disponible."
                );
            }

            return;
        }


        displaySongs(songs);

        currentOffset += songs.length;


        if (
            moreButton &&
            currentOffset < totalSongs
        ) {

            moreButton.style.display = "block";

            moreButton.innerHTML =
                "➕ Charger plus (" +
                currentOffset +
                " / " +
                totalSongs +
                ")";

        } else if (moreButton) {

            moreButton.style.display = "none";
        }


        status(
            "🎵 <b>" +
            currentOffset +
            "</b> chanson(s) affichée(s)."
        );

    } catch (error) {

        console.error(error);

        status(
            "❌ Impossible de charger les chansons."
        );

    } finally {

        isLoading = false;
    }
}


// =====================================================
// AFFICHER LES CHANSONS
// =====================================================

function displaySongs(songs) {

    songs.forEach(song => {

        const title =
            song.title ||
            "Titre inconnu";

        const duration =
            formatDuration(song.length);

        const artistName =
            getCredits(song);


        // Recherche YouTube
        const youtubeQuery =
            encodeURIComponent(
                artistName + " " + title
            );

        const youtubeURL =
            "https://www.youtube.com/results?search_query=" +
            youtubeQuery;


        const card =
            document.createElement("div");

        card.className = "card";


        card.innerHTML = `

            <div class="cover">
                🎵
            </div>

            <div class="info">

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(artistName)}
                </p>

                <span>
                    ⏱️ ${duration}
                </span>

                <br><br>

                <button
                    class="listenButton"
                    onclick="openYouTube('${youtubeURL}')"
                    style="
                        padding:10px 16px;
                        border:none;
                        border-radius:12px;
                        cursor:pointer;
                        font-size:15px;
                    "
                >
                    ▶️ Écouter sur YouTube
                </button>

                <div style="
                    margin-top:8px;
                    opacity:.65;
                    font-size:12px;
                ">
                    🎼 MusicBrainz
                </div>

            </div>
        `;

        resultsBox.appendChild(card);
    });
}


// =====================================================
// OUVRIR YOUTUBE
// =====================================================

function openYouTube(url) {

    window.open(
        url,
        "_blank"
    );
}


// =====================================================
// ARTISTES CRÉDITÉS
// =====================================================

function getCredits(song) {

    if (
        !song["artist-credit"] ||
        song["artist-credit"].length === 0
    ) {
        return currentArtist
            ? currentArtist.name
            : "";
    }

    return song["artist-credit"]
        .map(item => {

            if (item.name) {
                return item.name;
            }

            if (
                item.artist &&
                item.artist.name
            ) {
                return item.artist.name;
            }

            return "";
        })
        .join("");
}


// =====================================================
// DURÉE
// =====================================================

function formatDuration(ms) {

    if (!ms) {
        return "Durée inconnue";
    }

    const seconds =
        Math.floor(ms / 1000);

    const minutes =
        Math.floor(seconds / 60);

    const remaining =
        seconds % 60;

    return (
        minutes +
        ":" +
        String(remaining).padStart(2, "0")
    );
}


// =====================================================
// CHARGER PLUS
// =====================================================

async function loadMore() {

    if (!currentArtist || isLoading) {
        return;
    }

    await loadSongs(false);
}


// =====================================================
// BOUTONS RAPIDES
// =====================================================

function quickSearch(name) {

    searchInput.value = name;

    searchArtist();
}


// =====================================================
// EFFACER
// =====================================================

function clearSearch() {

    searchInput.value = "";

    artistBox.innerHTML = "";

    resultsBox.innerHTML = "";

    currentArtist = null;
    currentOffset = 0;
    totalSongs = 0;

    if (moreButton) {
        moreButton.style.display = "none";
    }

    status(
        "🎶 Recherche un artiste..."
    );
}


// =====================================================
// ENTER
// =====================================================

if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        function(event) {

            if (event.key === "Enter") {

                event.preventDefault();

                searchArtist();
            }
        }
    );
}


// =====================================================
// MUSIQUES LOCALES
// =====================================================

function createLocalMusicButton() {

    const header =
        document.querySelector("header");

    if (!header) return;

    if (
        document.getElementById(
            "localMusicButton"
        )
    ) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "localMusicButton";

    button.textContent =
        "📁 Ajouter mes musiques";

    button.style.margin = "10px";
    button.style.padding = "10px 18px";
    button.style.border = "none";
    button.style.borderRadius = "15px";
    button.style.cursor = "pointer";


    const input =
        document.createElement("input");

    input.type = "file";
    input.accept = "audio/*";
    input.multiple = true;
    input.style.display = "none";


    input.addEventListener(
        "change",
        function() {
            showLocalMusic(input.files);
        }
    );


    button.onclick = function() {
        input.click();
    };


    header.appendChild(button);
    header.appendChild(input);
}


// =====================================================
// MUSIQUES LOCALES
// =====================================================

function showLocalMusic(files) {

    if (!files || files.length === 0) {
        return;
    }

    artistBox.innerHTML = `
        <div class="artistBox">

            <div class="artistIcon">
                🎧
            </div>

            <div>

                <h2>
                    Mes musiques
                </h2>

                <p>
                    ${files.length} fichier(s)
                </p>

            </div>

        </div>
    `;

    resultsBox.innerHTML = "";


    Array.from(files).forEach(file => {

        const audioURL =
            URL.createObjectURL(file);

        const card =
            document.createElement("div");

        card.className = "card";

        card.innerHTML = `

            <div class="cover">
                🎧
            </div>

            <div class="info">

                <h3>
                    ${escapeHTML(file.name)}
                </h3>

                <audio
                    controls
                    preload="metadata"
                    style="width:100%;"
                >
                    <source
                        src="${audioURL}"
                        type="${escapeHTML(file.type)}"
                    >
                </audio>

            </div>
        `;

        resultsBox.appendChild(card);
    });


    status(
        "🎧 Tes musiques locales sont prêtes."
    );
}


// =====================================================
// DÉMARRAGE
// =====================================================

createLocalMusicButton();

status(
    "🎶 Recherche un artiste : Elvis, Dadju, " +
    "Celine Dion, Selena Gomez..."
);
