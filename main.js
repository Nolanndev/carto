// Coordonnées du centre de Caen (Place Saint-Sauveur)
const caenCenter = [-.36, 49.183];

// Initialisation de la carte
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth/style.json',
    center: caenCenter,
    zoom: 14,
    minZoom: 12, // Empêche de trop dézoomer
    maxBounds: [ // Limite les mouvements autour de Caen
        [-.45, 49.13],
        [-.27, 49.23]
    ]
});

// Définition des couleurs par catégorie
const categoryColors = {
    'culture': {
        color: '#E63946',
        class: 'red'
    },
    'education': {
        color: '#4CAF50',
        class: 'green'
    },
    'commerce': {
        color: '#2196F3',
        class: 'blue'
    },
};

let mouseLngLat = null;
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;

// Ajouter la source et les couches une fois la carte chargée
map.on('load', function () {

    fetch('data.geojson') // Le fichier doit être servi par un serveur HTTP local
        .then(response => response.json())
        .then(data => {
            map.addSource('poi', {
                type: 'geojson',
                data: data
            });

            // Ajouter une couche pour chaque catégorie
            const categories = ['culture', 'education', 'commerce'];

            categories.forEach(category => {
                // Ajouter une couche de points pour chaque catégorie
                map.addLayer({
                    id: `${category}-points`,
                    type: 'circle',
                    source: 'poi',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': categoryColors[category].color,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': 'white'
                    },
                    filter: ['==', ['get', 'category'], category]
                });

                // Ajouter une couche de texte pour chaque catégorie
                map.addLayer({
                    id: `${category}-labels`,
                    type: 'symbol',
                    source: 'poi',
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-size': 12,
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top'
                    },
                    paint: {
                        'text-color': '#1D3557',
                        'text-halo-color': 'white',
                        'text-halo-width': 1
                    },
                    filter: ['==', ['get', 'category'], category]
                });

                // Ajouter des événements pour le survol et le clic
                map.on('mouseenter', `${category}-points`, function () {
                    map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', `${category}-points`, function () {
                    map.getCanvas().style.cursor = '';
                });

                map.on('click', `${category}-points`, function (e) {
                    const properties = e.features[0].properties;
                    const coordinates = e.features[0].geometry.coordinates.slice();

                    // Créer le contenu du popup
                    // <div class="popup-content ${categoryColors[category].class}">
                    const popupContent = `
                    <div class="popup-content">
                        <h3>${properties.name}</h3>
                        <p>${properties.description}</p>
                    </div>
                `;

                    // Créer et afficher le popup
                    new maplibregl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(popupContent)
                        .addTo(map);

                    setTimeout(() => {
                        const popupElement = document.querySelector('.maplibregl-popup-content');
                        if (popupElement) { popupElement.classList.add(categoryColors[category].class) }
                    }, 0);
                });


                map.on('mousemove', function (e) {
                    mouseLngLat = e.lngLat;
                });
            });
        });


    // Gestion des filtres par catégorie
    document.getElementById('toggle-culture').addEventListener('change', function (e) {
        const visibility = e.target.checked ? 'visible' : 'none';
        map.setLayoutProperty('culture-points', 'visibility', visibility);
        map.setLayoutProperty('culture-labels', 'visibility', visibility);
    });

    document.getElementById('toggle-education').addEventListener('change', function (e) {
        const visibility = e.target.checked ? 'visible' : 'none';
        map.setLayoutProperty('education-points', 'visibility', visibility);
        map.setLayoutProperty('education-labels', 'visibility', visibility);
    });

    document.getElementById('toggle-commerce').addEventListener('change', function (e) {
        const visibility = e.target.checked ? 'visible' : 'none';
        map.setLayoutProperty('commerce-points', 'visibility', visibility);
        map.setLayoutProperty('commerce-labels', 'visibility', visibility);
    });
});

function copyCoordinates() {
    if (mouseLngLat) {
        const text = `${mouseLngLat.lng.toFixed(6)}, ${mouseLngLat.lat.toFixed(6)}`;
        navigator.clipboard.writeText(text).then(() => {
            console.log("Coordonnées copiées :", text);
        }).catch(err => {
            console.error("Erreur lors de la copie :", err);
        });
    }
    hideContextMenu();
    showToast('Coordonnées copiées dans le presse-papier')
}

function setStartPoint() {
    if (!mouseLngLat) return;

    if (startMarker) startMarker.remove();

    startMarker = new maplibregl.Marker({ color: 'green' })
        .setLngLat([mouseLngLat.lng, mouseLngLat.lat])
        .addTo(map);
    startPoint = { lng: mouseLngLat.lng, lat: mouseLngLat.lat };

    console.log("Point de départ défini :", mouseLngLat);
    hideContextMenu();
}

function setEndPoint() {
    if (!mouseLngLat) return;

    if (endMarker) endMarker.remove();

    endMarker = new maplibregl.Marker({ color: 'red' })
        .setLngLat([mouseLngLat.lng, mouseLngLat.lat])
        .addTo(map);
    endPoint = { lng: mouseLngLat.lng, lat: mouseLngLat.lat };

    console.log("Point d'arrivée défini :", mouseLngLat);
    hideContextMenu();
}

function calculateRoute() {
    if (!startPoint && !endPoint) {
        return showToast(`Veuillez définir un point de départ et un point d'arrivée`, true)
    }
    if (!startPoint) {
        return showToast(`Veuillez définir un point de départ`, true)
    }
    if (!endPoint) {
        return showToast(`Veuillez définir un point d'arrivée`, true)
    }

    // Empêche l'envoi d'une requête d'itinéraire pour deux points trop proches
    let dist = Math.sqrt(Math.pow(endPoint.lat - startPoint.lat, 2) + Math.pow(endPoint.lng - startPoint.lng, 2))
    if (dist < 0.005) {
        return showToast(`Les points de départ et d'arrivée sont trop proches`, true)
    }


    const body = {
        coordinates: [
            [startPoint.lng, startPoint.lat],
            [endPoint.lng, endPoint.lat]
        ],
        elevation: true,
        language: "fr-fr",
        radiuses: 1000
    }

    fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "5b3ce3597851110001cf6248c270bf2e94944fbe90b0b36e79d52eb2",
            "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8"
        },
        body: JSON.stringify(body)
    })
        .then(response => {
            if (!response.ok) {
                showToast(`L'itinéraire n'a pas pu être calculé`, 4000, true)
                throw new Error(`Erreur: ${response.status} : ${response.statusText}`)
            }
            return response.json()
        })
        .then(response => {

            // Supprimer les anciennes sources/couches s'il y en a
            if (map.getLayer('route')) {
                map.removeLayer('route');
            }
            if (map.getSource('route')) {
                map.removeSource('route');
            }

            map.addSource('route', {
                type: 'geojson',
                data: response
            });

            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    // 'line-color': '#0074D9',
                    'line-color': '#ff0000',
                    'line-width': 4
                }
            });

            // Zoomer sur l'itinéraire
            const coords = response.features[0].geometry.coordinates;
            const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
            map.fitBounds(bounds, { padding: 200 });

        })
        .catch(error => {
            // TODO Le toast d'erreur ne s'affiche pas en rouge
            console.error(`L'itinéraire n'a pas pu être calculé`, error)
            showToast(`L'itinéraire n'a pas pu être calculé`, 4000, true)
        })
}

function deleteRoute() {
    console.log('Suppression de l\'itinéraire');
    if (map.getLayer('route')) {
        map.removeLayer('route');
    }
    if (map.getSource('route')) {
        map.removeSource('route');
    }
    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();
    startMarker = null;
    endMarker = null;
    startPoint = null;
    endPoint = null;
    showToast('Itinéraire supprimé')
}

function zoomIn() {
    map.zoomIn();
}

function zoomOut() {
    map.zoomOut();
}

function resetView() {
    map.flyTo({
        center: [caenCenter[0], caenCenter[1]],
        zoom: 14
    });
}


// =================================================================
//   CCC   L      III   CCC        DDD    RRRR    OOO   III  TTTTT
//  C   C  L       I   C   C       D  D   R   R  O   O   I     T
//  C      L       I   C           D   D  R   R  O   O   I     T
//  C      L       I   C           D   D  RRRR   O   O   I     T
//  C   C  L       I   C   C       D  D   R  R   O   O   I     T
//   CCC   LLLLL  III   CCC        DDD    R   R   OOO   III    T
// =================================================================
// * * * CLIC DROIT



const menu = document.getElementById('context-menu');
let clickLngLat = null;

map.getCanvas().addEventListener('contextmenu', function (e) {
    e.preventDefault();

    const rect = map.getCanvas().getBoundingClientRect();

    menu.style.left = `${e.clientX - rect.left}px`;
    menu.style.top = `${e.clientY - rect.top}px`;
    menu.style.display = 'block';

    clickLngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
});

// Masquer si clic ailleurs
map.getCanvas().addEventListener('click', () => {
    menu.style.display = 'none';
});

// fermer le menu contextuel si on clique en dehors
document.addEventListener('click', function (event) {
    const menu = document.getElementById('context-menu');
    if (!menu.contains(event.target)) {
        hideContextMenu();
    }
});

// fermer le menu contextuel
function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'none';
}



// ====================================
//  TTTTT   OOO     A     SSS   TTTTT
//    T    O   O   A A   S        T
//    T    O   O  A   A   SSS     T
//    T    O   O  AAAAA      S    T
//    T    O   O  A   A      S    T
//    T     OOO   A   A  SSSS     T
// ====================================
// * * * TOAST



function showToast(message, error = false, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (error) {

        toast.classList.add('toastError')
    } else {
        toast.classList.remove('toastError')
    }
    // error ? toast.classList.add('toastError') : toast.classList.remove('toastError')
    setTimeout(() => toast.classList.remove('show'), duration)
}