"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:

const axios = require('axios');
const mqtt = require('mqtt');

class Heizoel24Mex extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "heizoel24-mex",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        global.topic1 = ['DataReceived', 'SensorId', 'IsMain', 'CurrentVolumePercentage', 'CurrentVolume', 'NotifyAtLowLevel', 'NotifyAtAlmostEmptyLevel', 'NotificationsEnabled', 'Usage', 'RemainsUntil', 'MaxVolume', 'ZipCode', 'MexName', 'LastMeasurementTimeStamp', 'LastMeasurementWithDifferentValue', 'BatteryPercentage', 'Battery', 'LitresPerCentimeter', 'LastMeasurementWasSuccessfully', 'SensorTypeId', 'HasMeasurements', 'MeasuredDaysCount', 'LastMeasurementWasTooHigh', 'YearlyOilUsage', 'RemainingDays', 'LastOrderPrice', 'ResultCode', 'ResultMessage'];
        global.topic2 = ['LastOrderPrice', 'PriceComparedToYesterdayPercentage', 'PriceForecastPercentage', 'HasMultipleMexDevices', 'DashboardViewMode', 'ShowComparedToYesterday', 'ShowForecast', 'ResultCode', 'ResultMessage'];
        global.RemainsUntilCombined = ['MonthAndYear', 'RemainsValue', 'RemainsUnit'];
        global.inhaltTopic1 = []
        global.inhaltTopic2 = []
        global.inhaltRemainsUntilCombined = []
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        let session_id = "";
        const debug = false;
        const username = this.config.username;
        const passwort = this.config.passwort;
        const broker_address = this.config.broker_address;
        const mqtt_active = this.config.mqtt_active;
        const mqtt_user = this.config.mqtt_user;
        const mqtt_pass = this.config.mqtt_pass;
        const mqtt_port = this.config.mqtt_port;

		if (username == "" || passwort == "") {
			this.log.error(`User email and/or user password empty - please check instance configuration`);
			this.terminate ? this.terminate('User email and/or user password empty - please check instance configuration', 1) : process.exit(0);
		}
        if (mqtt_active) {
		    if (broker_address == "" || broker_address == "0.0.0.0") {
			    this.log.error(`MQTT IP address is empty - please check instance configuration`);
			    this.terminate ? this.terminate('MQTT IP address is empty - please check instance configuration', 1) : process.exit(0);
		    }
            global.client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
                username: mqtt_user,
                password: mqtt_pass
            });
        } else {
            global.client = "dummy";
        }
        if (debug) {
            this.log.info("config username: " + username);
            this.log.info("config passwort: " + this.config.passwort);
            this.log.info("config broker_address: " + this.config.broker_address);
            this.log.info("config mqtt_active: " + this.config.mqtt_active);
            this.log.info("config mqtt_user: " + this.config.mqtt_user);
            this.log.info("config mqtt_pass: " + this.config.mqtt_pass);
            this.log.info("config mqtt_port: " + this.config.mqtt_port);
        }
        await main(this);

    async function mqtt_send(client, topic, wert) {
        if (mqtt_active) {
            client.publish("MEX/" + topic, wert);
        }
    }
    
    async function login() {
        if (debug) {
            console.log('Login in...');
        }
        const url = "https://api.heizoel24.de/app/api/app/Login";
        const newHeaders = { 'Content-type': 'application/json' };
        try {
            const reply = await axios.post(url, { "Password": passwort, "Username": username }, { headers: newHeaders });
            if (reply.status === 200) {
                if (debug) {
                    console.log("Login OK");
                }
                const reply_json = reply.data;
                if (reply_json['ResultCode'] === 0) {
                    session_id = reply_json['SessionId'];
                    if (debug) {
                        console.log('Session ID: ' + session_id);
                    }
                    return true;
                } else {
                    if (debug) {
                        console.log('ResultCode nicht 0. Keine Session ID erhalten!');
                    }
                }
            }
        } catch (error) {
            if (debug) {
                console.log('Login fehlgeschlagen! Heizoel24 Login Status Code: ' + error.response.status);
            }
        }
        return false;
    }
    
    async function mex() {
        const login_status = await login();
        if (!login_status) {
            return "error";
        }
        if (debug) {
            console.log('Refresh sensor data cache...');
        }
        const url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/1/False`;
        try {
            const reply = await axios.get(url);
            if (reply.status === 200) {
                if (debug) {
                    console.log("Daten wurden empfangen");
                }
                return reply;
            }
        } catch (error) {
            if (debug) {
                console.log('Heizoel24 GetDashboardData Status Code: ' + error.response.status);
            }
        }
        return "error";
    }
    
    async function main() {
        const client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
            username: mqtt_user,
            password: mqtt_pass
        });
    
        const daten = await mex();
        if (daten === "error") {
            if (debug) {
                console.log("Fehler. Keine Daten empfangen.");
            }
            inhaltTopic1[0] = false
            await mqtt_send(client, "Items/DataReceived", false);
            client.end();
            return;
        }
        const datenJson = daten.data;
        if (debug) {
            console.log();
            console.log("JSON-Daten:");
            console.log("===========");
            console.log();
            console.log(datenJson);
            console.log();
            console.log("---------------------");
            console.log();
        }
        for (let n = 0; n < topic2.length; n++) {
            if (debug) {
                console.log(topic2[n] + ":", datenJson[topic2[n]]);
            }
            const result = datenJson[topic2[n]] || '---';
            inhaltTopic2[n] = result;
            await mqtt_send(client, "PricingForecast/" + topic2[n], result.toString());
        }
        let items = datenJson["Items"][0];
        if (debug) {
            console.log("---------------------");
        }
        for (let n = 0; n < topic1.length; n++) {
            if (debug) {
                console.log(topic1[n] + ":", items[topic1[n]]);
            }
            const result = items[topic1[n]] || '---';
            inhaltTopic1[n] = result;
            await mqtt_send(client, "Items/" + topic1[n], result.toString());
        }
        await mqtt_send(client, "Items/DataReceived", 'true');
        let daten3 = items['RemainsUntilCombined'];
        if (debug) {
            console.log("---------------------");
            console.log('RemainsUntilCombined:');
        }
        for (let n = 0; n < RemainsUntilCombined.length; n++) {
            if (debug) {
                console.log(RemainsUntilCombined[n] + ":", daten3[RemainsUntilCombined[n]]);
            }
            const result = daten3[RemainsUntilCombined[n]] || '---';
            inhaltRemainsUntilCombined[n] = result;
            await mqtt_send(client, "RemainsUntilCombined/" + RemainsUntilCombined[n], result.toString());
        }
        if (mqtt_active) {
            client.end();
        }
    }
    
    for (let n = 0; n < topic1.length; n++) {
        let typ = typeof inhaltTopic1[n];
        await this.setObjectNotExistsAsync(topic1[n], {
            type: "state",
            common: {
                name: topic1[n],
                type: typ,
                role: typ,
                read: true,
                write: true,
            },
            native: {},
        });
        this.subscribeStates(topic1[n]);
        await this.setStateAsync(topic1[n], { val: inhaltTopic1[n], ack: true });
    }

    for (let n = 0; n < topic2.length; n++) {
        let typ = typeof inhaltTopic2[n];
        await this.setObjectNotExistsAsync(topic2[n], {
            type: "state",
            common: {
                name: topic2[n],
                type: typ,
                role: typ,
                read: true,
                write: true,
            },
            native: {},
        });
        this.subscribeStates(topic2[n]);
        await this.setStateAsync(topic2[n], { val: inhaltTopic2[n], ack: true });
    }

    for (let n = 0; n < RemainsUntilCombined.length; n++) {
        let typ = typeof inhaltRemainsUntilCombined[n];
        await this.setObjectNotExistsAsync(RemainsUntilCombined[n], {
            type: "state",
            common: {
                name: RemainsUntilCombined[n],
                type: typ,
                role: typ,
                read: true,
                write: true,
            },
            native: {},
        });
        this.subscribeStates(RemainsUntilCombined[n]);
        await this.setStateAsync(RemainsUntilCombined[n], { val: inhaltRemainsUntilCombined[n], ack: true });
    }

	// this.log.info(`Finished - stopping instance`);
	this.terminate ? this.terminate('Everything done. Going to terminate till next schedule', 0) : process.exit(0);

    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

     /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }

}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Heizoel24Mex(options);
} else {
    // otherwise start the instance directly
    new Heizoel24Mex();
}
