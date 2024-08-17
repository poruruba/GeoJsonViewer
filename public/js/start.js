'use strict';

const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

const default_latlng = { lat: 35.45270998308742, lng: 139.64288124427858 };

let map;
let marker;
let infoWindow;
let listener;

let prefectureFeatures;
let municipalityFeatures;
let targetPrefectureFeature;
let externalFeatures;
let rangeFeature;

function initMap() {
    vue.onMapLibLoaded();
}

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        selecting_data: "",
        selected_data: "",
        external_url: "",
        selecting_trafic_type: "",
    },
    computed: {
    },
    methods: {
        onMapLibLoaded: async function () {
            map = new google.maps.Map(document.getElementById('map'), {
                zoom: 15,
                center: default_latlng,
                draggableCursor: "pointer"
            });
            infoWindow = new google.maps.InfoWindow({ content: "" });
            marker = new google.maps.Marker({
                map: map,
                position: default_latlng,
                icon: {
                    url: "https://maps.google.com/mapfiles/kml/paddle/go.png",
                    scaledSize: new google.maps.Size(40, 40),
                }
            });
            map.addListener('click', (event)=>{
                console.log(event);
            });

            this.update_currentPosition();
        },

        unload_features: function(){
            if( prefectureFeatures)
                for(let feature of prefectureFeatures )
                    map.data.remove(feature);
            prefectureFeatures = null;

            if( municipalityFeatures )
                for( let feature of municipalityFeatures )
                    map.data.remove(feature);
            municipalityFeatures = null;

            if( externalFeatures )
                for( let feature of externalFeatures )
                    map.data.remove(feature);
            externalFeatures = null;

            if( rangeFeature )
                for( let feature of rangeFeature )
                    map.data.remove(feature);
            rangeFeature = null;

            if( listener ){
                google.maps.event.removeListener(listener);
                listener = null;
            }
        },
        load_data: async function(){
            this.unload_features();
            if( this.selecting_data == 'prefecture')
                await this.load_prefecture();
            else if( this.selecting_data == 'external_url')
                await this.load_external_url();
            else if( this.selecting_data == 'external_file')
                await this.load_external_file();
            else if( this.selecting_data == 'trafic')
                await this.load_trafic();
        },

        file_select_callback: async function(files){
            if( files.length <= 0 )
                return;

            try{
                this.dialog_close("#file_select_dialog");
                this.progress_open();
                var text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.onerror = (error) => {
                        reject(error);
                    }
                    reader.readAsText(files[0]);
                });
                var json = JSON.parse(text);

                externalFeatures = map.data.addGeoJson(json);

                listener = map.data.addListener('click', async (event) => {
                    console.log(event);
                    console.log(event.latLng.lat(), event.latLng.lng());
                    event.feature.forEachProperty((value, key) =>{
                        console.log(key, value);
                    });
                });
            }catch(error){
                console.error(error);
                alert(error);
            }finally{
                this.progress_close();
            }
        },
        load_external_file: async function(){
            this.dialog_open("#file_select_dialog");
        },

        load_external_url: async function(){
            var url = prompt("GeoJsonファイルのURLを入力してください。" );
            if( !url )
                return;

            try{
                this.progress_open();
                var input = {
                    url: url,
                    method: "GET",
                };
                var result = await do_http(input);
                console.log("loaded");
                externalFeatures = map.data.addGeoJson(result);

                listener = map.data.addListener('click', async (event) => {
                    console.log(event);
                    console.log(event.latLng.lat(), event.latLng.lng());
                    event.feature.forEachProperty((value, key) =>{
                        console.log(key, value);
                    });
                });
            }catch(error){
                console.error(error);
                alert(error);
            }finally{
                this.progress_close();
            }
        },
        load_prefecture: async function(){
            try{
                this.progress_open();

                var input = {
                    url: "/location_console/geojson/japan.geojson",
                    method: "GET",
                };
                var result = await do_http(input);
                console.log("loaded");
                prefectureFeatures = map.data.addGeoJson(result);

                listener = map.data.addListener('click', async (event) => {
                    console.log(event);
                    console.log(event.latLng.lat(), event.latLng.lng());
                    event.feature.forEachProperty((value, key) =>{
                        console.log(key, value);
                    });
    
                    if( event.feature.getProperty("id") ){
                        if( municipalityFeatures){
                            for( let feature of municipalityFeatures )
                                map.data.remove(feature);
                            municipalityFeatures = null;
                            map.data.add(targetPrefectureFeature);
                            targetPrefectureFeature = null;
                        } 
    
                        try{
                            this.progress_open();
                            var input = {
                                url: "/location_console/geojson/N03-19_" + String(event.feature.getProperty("id")).padStart(2, "0") + "_190101.geojson",
                                method: "GET",
                            };
                            var result = await do_http(input);
                            console.log("loaded");
                            municipalityFeatures = map.data.addGeoJson(result);
                            targetPrefectureFeature = event.feature;
                            map.data.remove(targetPrefectureFeature);
                        }catch(error){
                            console.error(error);
                            alert(error);
                        }finally{
                            this.progress_close();
                        }
                    }
                });
            }catch(error){
                console.error(error);
                alert(error);
            }finally{
                this.progress_close();
            }
        },
        load_trafic: async function(){
            var bounds = map.getBounds();
            var ne = [bounds.getNorthEast().lat(), bounds.getNorthEast().lng()];
            var sw = [bounds.getSouthWest().lat(), bounds.getSouthWest().lng()];

            try{
                this.progress_open();
                var input = {
                    url: "/geojson-search",
                    body: {
                        bounds: [
                            { lat: ne[0], lng: ne[1] },
                            { lat: sw[0], lng: ne[1] },
                            { lat: sw[0], lng: sw[1] },
                            { lat: ne[0], lng: sw[1] }
                        ],
                        type: this.selecting_trafic_type
                    },
                };
                var result = await do_http(input);
                console.log("loaded");
                rangeFeature = map.data.addGeoJson(result);

                listener = map.data.addListener('click', async (event) => {
                    console.log(event);
                    console.log(event.latLng.lat(), event.latLng.lng());
                    var properties = "";
                    event.feature.forEachProperty((value, key) =>{
                        console.log(key, value);
                        if( value )
                            properties += "<li>" + key + ": " + value + "</li>";
                    });

                    let content = "<ul>" + properties + "</ul>";
                    let _content = content;
                    let _position = event.latLng;
                    infoWindow.setContent(_content);
                    infoWindow.setPosition(_position);
                    infoWindow.open(map);
                });
            }catch(error){
                console.error(error);
                alert(error);
            }finally{
                this.progress_close();
            }
        },
        
        update_currentPosition: async function(){
            navigator.geolocation.getCurrentPosition((position) => {
                var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                marker.setPosition(latlng);
                map.setCenter(latlng);
            }, (error) => {
                console.error(error);
            }, { timeout: 30000 });
        }
    },
    created: function(){
    },
    mounted: function(){
        proc_load();
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );
