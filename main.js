// =======================================================================
//   CCC    OOO   N   N   SSS   TTTTT    A    N   N  TTTTT  EEEEE   SSS
//  C   C  O   O  NN  N  S        T     A A   NN  N    T    E      S
//  C      O   O  N N N   SSS     T    A   A  N N N    T    EEE     SSS
//  C      O   O  N  NN      S    T    AAAAA  N  NN    T    E          S
//  C   C  O   O  N   N      S    T    A   A  N   N    T    E          S
//   CCC    OOO   N   N  SSSS     T    A   A  N   N    T    EEEEE  SSSS
// =======================================================================
// * * * CONSTANTES



const caenCenter = [-.36, 49.183];
const categoryColors = {
    'culture': {
        color: '#E63946',
        class: 'red',
        icon: 'domain'
    },
    'education': {
        color: '#4CAF50',
        class: 'green',
        icon: 'school'
    },
    'commerce': {
        color: '#2196F3',
        class: 'blue',
        icon: 'storefront'
    },
};
const categories = ['culture', 'education', 'commerce'];



// ======================
//  M   M    A    PPPP
//  MM MM   A A   P   P
//  M M M  A   A  P   P
//  M   M  AAAAA  PPPP
//  M   M  A   A  P
//  M   M  A   A  P
// ======================
// * * * MAP



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

let mouseLngLat = null;
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;

map.on('load', function () {
    window.addEventListener('resize', () => {
        map.resize();
    });

    fetch('data.geojson')
        .then(response => response.json())
        .then(data => {
            map.addSource('poi', {
                type: 'geojson',
                data: data
            });

            

            const ul = document.getElementById('points-ul')
            
            data.features = data.features.slice().sort((a, b) => {
                const catA = a.properties.category.toLowerCase();
                const catB = b.properties.category.toLowerCase();
            
                if (catA < catB) return -1;
                if (catA > catB) return 1;
            
                // Si les catégories sont identiques, trier par nom
                const nameA = a.properties.name.toLowerCase();
                const nameB = b.properties.name.toLowerCase();
                return nameA.localeCompare(nameB);
            });

            data.features.forEach(feature => {
                const category = feature.properties.category;
                const li = document.createElement('li');
                li.style.backgroundColor = categoryColors[category].color
                // li.classList.add(categoryColors[category].color);
                
                li.innerHTML = `
                <span class="material-symbols-outlined">${categoryColors[category].icon}</span>
                <span>${feature.properties.name}</span>
                `;
                
                li.addEventListener('click', (e) => {
                    map.flyTo({ center: feature.geometry.coordinates, zoom: 16, pitch: 0, bearing: 0 });
                });
                
                ul.appendChild(li);
            });
            document.getElementById("points-list").appendChild(ul);

            categories.forEach(category => {
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

                map.on('mouseenter', `${category}-points`, () => {
                    map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', `${category}-points`, () => {
                    map.getCanvas().style.cursor = '';
                });

                map.on('click', `${category}-points`, function (e) {
                    const properties = e.features[0].properties;
                    const coordinates = e.features[0].geometry.coordinates.slice();
                    const popupContent = `
                        <div class="popup-content">
                            <h3>${properties.name}</h3>
                            <p>${properties.description}</p>
                        </div>`;

                    new maplibregl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(popupContent)
                        .addTo(map);

                    setTimeout(() => {
                        const popupElement = document.querySelector('.maplibregl-popup-content');
                        if (popupElement) {
                            popupElement.classList.add(categoryColors[category].class);
                        }
                    }, 0);
                });

                map.on('mousemove', function (e) {
                    mouseLngLat = e.lngLat;
                });
            });
        });

    // Filtres
    ['culture', 'education', 'commerce'].forEach(category => {
        document.getElementById(`toggle-${category}`).addEventListener('change', function (e) {
            const visibility = e.target.checked ? 'visible' : 'none';
            map.setLayoutProperty(`${category}-points`, 'visibility', visibility);
            map.setLayoutProperty(`${category}-labels`, 'visibility', visibility);
        });
    });
});

// Copie les coordonnées de la souris dans le presse-papier
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
        zoom: 14,
        bearing: 0,
        pitch: 0,
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



// ===================================================================
//  DDD    III  V   V        GGG     A    U   U   CCC   H   H  EEEEE
//  D  D    I   V   V       G   G   A A   U   U  C   C  H   H  E
//  D   D   I   V   V       G      A   A  U   U  C      HHHHH  EEE
//  D   D   I    V V        G  GG  AAAAA  U   U  C      H   H  E
//  D  D    I    V V        G   G  A   A  U   U  C   C  H   H  E
//  DDD    III    V          GGGG  A   A   UUU    CCC   H   H  EEEEE
// ===================================================================
// * * * DIV GAUCHE



// affiche / cache la liste des points
document.querySelector('#points-list h4').addEventListener('click', (e) => {
    let list = document.getElementById('points-ul')
    if (list.style.display == 'none') {
        list.style.display = 'block'
    } else {
        list.style.display = 'none'
    }
})

