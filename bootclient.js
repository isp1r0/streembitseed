﻿/*

This file is part of Streembit application. 
Streembit is an open source project to create a real time communication system for humans and machines. 

Streembit is a free software: you can redistribute it and/or modify it under the terms of the GNU General Public License 
as published by the Free Software Foundation, either version 3.0 of the License, or (at your option) any later version.

Streembit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty 
of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with Streembit software.  
If not, see http://www.gnu.org/licenses/.
 
-------------------------------------------------------------------------------------------------------------------------
Author: Tibor Zsolt Pardi 
Copyright (C) 2016 The Streembit software development team
-------------------------------------------------------------------------------------------------------------------------

*/

'use strict';

var streembit = streembit || {};

var net = require('net');
var dns = require('dns');
var async = require('async');

streembit.bootclient = (function (client, logger, config, events) {
    
    function is_ipaddress(address) {
        var ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/; // /^(\d{ 1, 3 })\.(\d { 1, 3 })\.(\d { 1, 3 })\.(\d { 1, 3 })$/;   
        var valid = ipPattern.test(address);
        return valid;
    }
    
    function get_seed_ipaddress(address, callback) {
        if (!address) {
            return callback("get_seed_ipaddress error: invalid address");
        }
        
        var isip = is_ipaddress(address);
        if (isip) {
            return callback(null, address);
        }       
        
        dns.resolve4(address, function (err, addresses) {
            if (err) {
                return callback(err);
            }
            
            if (!addresses || !addresses.length) {
                return callback("dns resolve failed to get addresses");
            }
            
            callback(null, addresses[0]);
        });
    }
    
    client.resolveseeds = function (seeds, callback) {
        if (!seeds || !Array.isArray(seeds)) {
            return callback();
        }        
        
        async.map(
            seeds,
            function (seed, done) {
                var result = {};
                try {
                    // get the IP address
                    get_seed_ipaddress(seed.address, function (err, address) {
                        if (err) {
                            result.error = err;
                            return done(null, result);
                        }
                        
                        result.address = address;
                        result.port = seed.port;
                        result.public_key = seed.public_key;
                        done(null, result);                
                    });
                }
                catch (e) {
                    result.error = e;
                    done(null, result);
                }
            },
            function (err, results) {
                if (err || results.length == 0) {
                    return callback("Failed to resolve any seed address");
                }
                
                var seedlist = [];
                results.forEach(function (item, index, array) {
                    if (item.address && !item.error) {
                        seedlist.push({address: item.address, port: item.port, public_key: item.public_key});
                    }
                });

                callback(null, seedlist);
            }
        );
    };

    client.discovery = function (address, seed, callback) {
        if (is_ipaddress(address)) {
            return callback(null, address);
        }

        var client = net.connect( 
            {
                port: seed.port, 
                host: seed.address
            },
            function () {
                client.write(JSON.stringify({ type: 'DISCOVERY' }));
            }
        );
        
        client.on('data', function (data) {
            client.end();
            var reply = JSON.parse(data.toString());
            if (reply && reply.address) {
                var ipv6prefix = "::ffff:";
                if (reply.address.indexOf(ipv6prefix) > -1) {
                    reply.address = reply.address.replace(ipv6prefix, '');
                }

                callback(null, reply.address);
            }
            else {
                callback("discovery failed for " + seed.address + ":" + seed.port);
            }
        });
        
        client.on('end', function () {
        });
        
        client.on('error', function (err) {
            callback("self discovery failed with " + seed.address + ":" + seed.port + ". " + (err.message ? err.message : err));
        });
    };
    
    return client;

}(streembit.bootclient || {}));


module.exports = streembit.bootclient;