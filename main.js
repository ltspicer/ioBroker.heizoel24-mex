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
        global.inhaltTopic1 = [];
        global.inhaltTopic2 = [];
        global.inhaltRemainsUntilCombined = [];
    }

    async LogMessage(level, message) {
        if (level == "info") {
            this.log.info(message);
        }
        if (level == "warn") {
            this.log.warn(message);
        }
        if (level == "error") {
            this.log.error(message);
        }
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        global.session_id = "";
        global.debug = false;
        global.username = this.config.username;
        global.passwort = this.config.passwort;
        global.broker_address = this.config.broker_address;
        global.mqtt_active = this.config.mqtt_active;
        global.mqtt_user = this.config.mqtt_user;
        global.mqtt_pass = this.config.mqtt_pass;
        global.mqtt_port = this.config.mqtt_port;

		if (username == "" || passwort == "") {
			await this.LogMessage("error", "User email and/or user password empty - please check instance configuration");
			this.terminate ? this.terminate('User email and/or user password empty - please check instance configuration', 1) : process.exit(0);
		}
        if (mqtt_active) {
		    if (broker_address == "" || broker_address == "0.0.0.0") {
			    await this.LogMessage("error", "MQTT IP address is empty - please check instance configuration");
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
            await this.LogMessage("info", "config username: " + username);
            await this.LogMessage("info", "config passwort: " + this.config.passwort);
            await this.LogMessage("info", "config broker_address: " + this.config.broker_address);
            await this.LogMessage("info", "config mqtt_active: " + this.config.mqtt_active);
            await this.LogMessage("info", "config mqtt_user: " + this.config.mqtt_user);
            await this.LogMessage("info", "config mqtt_pass: " + this.config.mqtt_pass);
            await this.LogMessage("info", "config mqtt_port: " + this.config.mqtt_port);
        }
        let datenEmpfangen = await this.main();

        if (datenEmpfangen === true) {

// Items

            for (let n = 0; n < topic1.length; n++) {
                let typ = typeof inhaltTopic1[n];
                await this.setObjectNotExistsAsync("Items." + topic1[n], {
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
                this.subscribeStates("Items." + topic1[n]);
                await this.setStateAsync("Items." + topic1[n], { val: inhaltTopic1[n], ack: true });
            }

// PricingForecast

            for (let n = 0; n < topic2.length; n++) {
                let typ = typeof inhaltTopic2[n];
                await this.setObjectNotExistsAsync("PricingForecast." + topic2[n], {
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
                this.subscribeStates("PricingForecast." + topic2[n]);
                await this.setStateAsync("PricingForecast." + topic2[n], { val: inhaltTopic2[n], ack: true });
            }

// RemainsUntilCombined

            for (let n = 0; n < RemainsUntilCombined.length; n++) {
                let typ = typeof inhaltRemainsUntilCombined[n];
                await this.setObjectNotExistsAsync("RemainsUntilCombined." + RemainsUntilCombined[n], {
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
                this.subscribeStates("RemainsUntilCombined." + RemainsUntilCombined[n]);
                await this.setStateAsync("RemainsUntilCombined." + RemainsUntilCombined[n], { val: inhaltRemainsUntilCombined[n], ack: true });
            }
        } else {
            await this.setObjectNotExistsAsync("Items." + topic1[0], {
                type: "state",
                common: {
                    name: topic1[0],
                    type: "boolean",
                    role: "boolean",
                    read: true,
                    write: true,
                },
                native: {},
            });
            this.subscribeStates("Items." + topic1[0]);
            await this.setStateAsync("Items." + topic1[0], { val: false, ack: true });
            await this.LogMessage("error", "Keine Daten empfangen");
            this.terminate ? this.terminate('Keine Daten empfangen', 1) : process.exit(1);
        }

	    // this.log.info(`Finished - stopping instance`);
        await this.LogMessage("info", "Alles erledigt. Beende mich bis zum nächsten Schedule-Aufruf");
	    this.terminate ? this.terminate('Everything done. Going to terminate till next schedule', 0) : process.exit(0);
    }

    async mqtt_send(client, topic, wert) {
        if (mqtt_active) {
            client.publish("MEX/" + topic, wert);
        }
    }
    
    async login() {
        if (debug) {
            await this.LogMessage("info", 'Login in...');
        }
        const url = "https://api.heizoel24.de/app/api/app/Login";
        const newHeaders = { 'Content-type': 'application/json' };
        try {
            const reply = await axios.post(url, { "Password": passwort, "Username": username }, { headers: newHeaders });
            if (reply.status === 200) {
                if (debug) {
                    await this.LogMessage("info", "Login OK");
                }
                const reply_json = reply.data;
                if (reply_json['ResultCode'] === 0) {
                    session_id = reply_json['SessionId'];
                    if (debug) {
                        await this.LogMessage("info", 'Session ID: ' + session_id);
                    }
                    await this.LogMessage("info", "Logged in");
                    return true;
                } else {
                    await this.LogMessage("error", "ResultCode nicht 0. Keine Session ID erhalten!");
                }
            }
        } catch (error) {
            await this.LogMessage("error", 'Login fehlgeschlagen! Heizoel24 Login Status Code: ' + error.response.status);
        }
        return false;
    }
    
    async mex() {
        const login_status = await this.login();
        if (!login_status) {
            return false;
        }
        if (debug) {
            await this.LogMessage("info", 'Refresh sensor data cache...');
        }
        const url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/1/False`;
        try {
            const reply = await axios.get(url);
            if (reply.status === 200) {
                if (debug) {
                    await this.LogMessage("info", "Daten wurden empfangen");
                }
                return reply;
            }
        } catch (error) {
            await this.LogMessage("error", 'Heizoel24 GetDashboardData Status Code: ' + error.response.status);
        }
        return false;
    }
    
    async main() {
        if (mqtt_active) {
            const client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
                username: mqtt_user,
                password: mqtt_pass
            });
        } else {
            const client = "dummy";
        }

        let daten = await this.mex();

        if (daten === false) {
            await this.LogMessage("error", "Keine Daten empfangen.");
            if (mqtt_active) {
                await this.mqtt_send(client, "Items/DataReceived", 'false');
                client.end();
            }
            return false;
        }

        const datenJson = daten.data;
        if (debug) {
            await this.LogMessage("info", " ");
            await this.LogMessage("info", "JSON-Daten:");
            await this.LogMessage("info", "===========");
            await this.LogMessage("info", " ");
        }
        for (let n = 0; n < topic2.length; n++) {
            if (debug) {
                await this.LogMessage("info", topic2[n] + ": " + datenJson[topic2[n]]);
            }
            let result = datenJson[topic2[n]] || '---';
            inhaltTopic2[n] = result;
            await this.mqtt_send(client, "PricingForecast/" + topic2[n], result.toString());
        }
        let items = datenJson["Items"][0];
        if (debug) {
            await this.LogMessage("info", "---------------------");
        }
        for (let n = 0; n < topic1.length; n++) {
            if (debug) {
                await this.LogMessage("info", topic1[n] + ": " + items[topic1[n]]);
            }
            let result = items[topic1[n]] || '---';
            inhaltTopic1[n] = result;
            await this.mqtt_send(client, "Items/" + topic1[n], result.toString());
        }
        await this.mqtt_send(client, "Items/DataReceived", 'true');
        inhaltTopic1[0] = true;
        let daten3 = items['RemainsUntilCombined'];
        if (debug) {
            await this.LogMessage("info", "---------------------");
            await this.LogMessage("info", 'RemainsUntilCombined:');
        }
        for (let n = 0; n < RemainsUntilCombined.length; n++) {
            if (debug) {
                await this.LogMessage("info", RemainsUntilCombined[n] + ": " + daten3[RemainsUntilCombined[n]]);
            }
            let result = daten3[RemainsUntilCombined[n]] || '---';
            inhaltRemainsUntilCombined[n] = result;
            await this.mqtt_send(client, "RemainsUntilCombined/" + RemainsUntilCombined[n], result.toString());
        }
        if (mqtt_active) {
            client.end();
        }
        return true;
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
