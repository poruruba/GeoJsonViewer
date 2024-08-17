'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const Redirect = require(HELPER_BASE + 'redirect');
const TextResponse = require(HELPER_BASE + 'textresponse');

const DB_HOST = "yDB‚ÌƒzƒXƒg–¼z";
const DB_PORT = yDB‚Ìƒ|[ƒg”Ô†z;
const DB_USER = "yDB‚Ìƒ†[ƒU–¼z";
const DB_PASSWORD = "yDB‚ÌƒpƒXƒ[ƒhz";
const DB_NAME = "yDB–¼z";

const mysql = require('mysql2/promise');

let conn;

async function db_connect(){
	if( conn != null ){
		try{
			await conn.query("SELECT 1");
			return conn;
		}catch(error){
			console.error(error);
		}
	}
	return mysql.createConnection({
		host: DB_HOST,
		port: DB_PORT,
		user: DB_USER,
		password: DB_PASSWORD,
		database: DB_NAME
	})
	.then(async (result) =>{
		conn = result;

		console.log("start");
	});
}

db_connect();

exports.handler = async (event, context, callback) => {
	await db_connect();

	var body = JSON.parse(event.body);
	console.log(body);

	if( event.path == "/geojson-search"){
		var bounds = body.bounds;
		var type = body.type;

		var polygon = "";
		for( var i = 0 ; i < bounds.length ; i++ ){
			if( i != 0 )
				polygon += ",";
			polygon += bounds[i].lng.toString() + " " + bounds[i].lat.toString();
		}
		if( bounds.length > 0 )
			polygon += "," + bounds[0].lng.toString() + " " + bounds[0].lat.toString();;
		
		var value = ["POLYGON((" + polygon + "))", type];
		var sql = "SELECT property, ST_AsGeoJSON(polygon) as json FROM geojson WHERE ST_Intersects(ST_GeomFromText(?, 4326), polygon) AND type = ?";
		var [rows, fields]  = await conn.execute(sql, value);
		var result = {
			type: "FeatureCollection",
			features: []
		};
		for( let item of rows ){
			var feature = {
				type: "Feature",
				properties: JSON.parse(item.property),
				geometry: JSON.parse(item.json)
			};
			result.features.push(feature);
		};
		
		return new TextResponse("application/json", JSON.stringify(result));
	}else

	if( event.path == '/geojson-search-prefecture'){
		var values = ["POINT(" + body.lng + " " + body.lat+ ")"];
		var [rows, fields] = await conn.query("SELECT code, name FROM prefecture WHERE ST_Contains(polygon, ST_GeomFromText(?, 4326))", values );
		if( rows.length <= 0 )
			throw new Error("prefecture not found");

		return new Response(rows[0]);
	}else

	if( event.path == '/geojson-search-municipality'){
		var prefecture_code = body.code;
		if( !prefecture_code ){
			var values = ["POINT(" + body.lng + " " + body.lat + ")"];
			var [rows, fields] = await conn.query("SELECT code, name FROM prefecture WHERE ST_Contains(polygon, ST_GeomFromText(?, 4326))", values );
			if( rows.length <= 0 )
				throw new Error("prefecture not found");
			
			prefecture_code = rows[0].code;
		}
		var values = [prefecture_code, "POINT(" + body.lng + " " + body.lat + ")"];
		var [rows, fields] = await conn.query("SELECT * FROM (SELECT * FROM municipality WHERE code=? ) T WHERE ST_Contains(T.polygon, ST_GeomFromText(?, 4326))", values );
		
		if( rows.length <= 0 )
			throw new Error("municipality not found");

		return new Response({ code: prefecture_code, property: JSON.parse(rows[0].property) });
	}else

	{
		throw new Error("endpoint not found");
	}
};
