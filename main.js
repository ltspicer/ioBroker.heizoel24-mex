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
        global.topic1 = ['SensorId', 'IsMain', 'CurrentVolumePercentage', 'CurrentVolume', 'NotifyAtLowLevel', 'NotifyAtAlmostEmptyLevel', 'NotificationsEnabled', 'Usage', 'RemainsUntil', 'MaxVolume', 'ZipCode', 'MexName', 'LastMeasurementTimeStamp', 'LastMeasurementWithDifferentValue', 'BatteryPercentage', 'Battery', 'LitresPerCentimeter', 'LastMeasurementWasSuccessfully', 'SensorTypeId', 'HasMeasurements', 'MeasuredDaysCount', 'LastMeasurementWasTooHigh', 'YearlyOilUsage', 'RemainingDays', 'LastOrderPrice', 'ResultCode', 'ResultMessage'];
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
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:

        let session_id = "";
        const debug = false;
        const username = this.config.username;
        const passwort = this.config.passwort;
        const broker_address = this.config.broker_address;
        const mqtt_active = this.config.mqtt_active;
        const mqtt_user = this.config.mqtt_user;
        const mqtt_pass = this.config.mqtt_pass;
        if (debug) {
            this.log.info("config username: " + username);
            this.log.info("config passwort: " + this.config.passwort);
            this.log.info("config broker_address: " + this.config.broker_address);
            this.log.info("config mqtt_active: " + this.config.mqtt_active);
            this.log.info("config mqtt_user: " + this.config.mqtt_user);
            this.log.info("config mqtt_pass: " + this.config.mqtt_pass);
        }
        await main(this);

    async function mqtt_send(client, topic, wert) {
        client.publish("MEX/" + topic, wert);
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
//        const topic1 = ['SensorId', 'IsMain', 'CurrentVolumePercentage', 'CurrentVolume', 'NotifyAtLowLevel', 'NotifyAtAlmostEmptyLevel', 'NotificationsEnabled', 'Usage', 'RemainsUntil', 'MaxVolume', 'ZipCode', 'MexName', 'LastMeasurementTimeStamp', 'LastMeasurementWithDifferentValue', 'BatteryPercentage', 'Battery', 'LitresPerCentimeter', 'LastMeasurementWasSuccessfully', 'SensorTypeId', 'HasMeasurements', 'MeasuredDaysCount', 'LastMeasurementWasTooHigh', 'YearlyOilUsage', 'RemainingDays', 'LastOrderPrice', 'ResultCode', 'ResultMessage'];
//        const topic2 = ['LastOrderPrice', 'PriceComparedToYesterdayPercentage', 'PriceForecastPercentage', 'HasMultipleMexDevices', 'DashboardViewMode', 'ShowComparedToYesterday', 'ShowForecast', 'ResultCode', 'ResultMessage'];
//        const RemainsUntilCombined = ['MonthAndYear', 'RemainsValue', 'RemainsUnit'];
    
        const client = mqtt.connect(`mqtt://${broker_address}`, {
            username: mqtt_user,
            password: mqtt_pass
        });
    
        const daten = await mex();
        if (daten === "error") {
            if (debug) {
                console.log("Fehler. Keine Daten empfangen.");
            }
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
            const result = datenJson[topic2[n]] || 'leer';
            inhaltTopic2[n] = result
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
            const result = items[topic1[n]] || 'leer';
            inhaltTopic1[n] = result
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
            const result = daten3[RemainsUntilCombined[n]] || 'leer';
            inhaltRemainsUntilCombined[n] = result
            await mqtt_send(client, "RemainsUntilCombined/" + RemainsUntilCombined[n], result.toString());
        }
        client.end();
    }
    
    for (let n = 0; n < topic1.length; n++) {
        await this.setObjectNotExistsAsync(topic1[n], {
            type: "state",
            common: {
                name: topic1[n],
                type: "string",
                role: "name",
                read: true,
                write: true,
            },
            native: {},
        });
        this.subscribeStates(topic1[n]);
        await this.setStateAsync(topic1[n], { val: inhaltTopic1[n], ack: true });
    }


    /*
    For every state in the system there has to be also an object of type state
    Here a simple template for a boolean variable named "testVariable"
    Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
    */
    await this.setObjectNotExistsAsync("testVariable", {
        type: "state",
        common: {
            name: "testVariable",
            type: "boolean",
            role: "indicator",
            read: true,
            write: true,
        },
        native: {},
    });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("testVariable");
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates("lights.*");
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates("*");

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync("testVariable", true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync("testVariable", { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync("admin", "iobroker");
        this.log.info("check user admin pw iobroker: " + result);

        result = await this.checkGroupAsync("admin", "admin");
        this.log.info("check group user admin group admin: " + result);
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

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

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
