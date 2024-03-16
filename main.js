"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.2
 */

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const mqtt = require("mqtt");
const fs = require("fs");

axios.defaults.timeout = 2000;

class Heizoel24Mex extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: "heizoel24-mex",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.topic1 = ["DataReceived", "SensorId", "IsMain", "CurrentVolumePercentage", "CurrentVolume", "NotifyAtLowLevel", "NotifyAtAlmostEmptyLevel", "NotificationsEnabled", "Usage", "RemainsUntil", "MaxVolume", "ZipCode", "MexName", "LastMeasurementTimeStamp", "LastMeasurementWithDifferentValue", "BatteryPercentage", "Battery", "LitresPerCentimeter", "LastMeasurementWasSuccessfully", "SensorTypeId", "HasMeasurements", "MeasuredDaysCount", "LastMeasurementWasTooHigh", "YearlyOilUsage", "RemainingDays", "LastOrderPrice", "ResultCode", "ResultMessage"];
        this.topic2 = ["LastOrderPrice", "PriceComparedToYesterdayPercentage", "PriceForecastPercentage", "HasMultipleMexDevices", "DashboardViewMode", "ShowComparedToYesterday", "ShowForecast", "ResultCode", "ResultMessage"];
        this.RemainsUntilCombined = ["MonthAndYear", "RemainsValue", "RemainsUnit"];

        this.roleTopic1 = ["indicator", "value", "indicator", "level", "level", "level.color.red", "level.color.red", "indicator", "value", "date", "level.max", "value", "value", "date", "date", "value.battery", "value.battery", "value", "indicator", "value", "indicator", "value", "indicator", "value", "value", "value", "value", "value"];
        this.roleTopic2 = ["value", "value", "value", "indicator", "value", "indicator", "indicator", "value", "value"];
        this.roleRemainsUntilCombined = ["value", "value", "value"];

        this.unitTopic1 = ["", "", "", "%", "L", "%", "%", "", "L/Day", "", "L", "", "", "", "", "%", "V", "L/cm", "", "", "", "Days", "", "L", "Days", "€|CHF", "", ""];
        this.unitTopic2 = ["€|CHF/100L", "%", "%", "", "", "", "", "", ""];
        this.unitRemainsUntilCombined = ["Month Year", "", ""];

        this.typTopic1 = ["boolean", "number", "boolean", "number", "number", "number", "number", "boolean", "number", "string", "number", "number", "string", "string", "string", "number", "number", "number", "boolean", "number", "boolean", "number", "boolean", "number", "number", "number", "number", "string"];
        this.typTopic2 = ["number", "number", "number", "boolean", "number", "boolean", "boolean", "number", "string"];
        this.typRemainsUntilCombined = ["string", "string", "string"];

        this.inhaltTopic1 = [];
        this.inhaltTopic2 = [];
        this.inhaltRemainsUntilCombined = [];
        this.client = null;
    }

    async onReady() {
        this.setState("info.connection", false, true);
        const username = this.config.username;
        const passwort = this.config.passwort;
        const broker_address = this.config.broker_address;
        const mqtt_active = this.config.mqtt_active;
        const mqtt_user = this.config.mqtt_user;
        const mqtt_pass = this.config.mqtt_pass;
        const mqtt_port = this.config.mqtt_port;
        const sensor_id = this.config.sensor_id;
        const storeJson = this.config.storeJson;
        const storeDir = this.config.storeDir;

        if (parseInt(sensor_id) < 1 || parseInt(sensor_id) > 20) {
            this.log.error("Sensor ID has no value between 1 and 20");
            this.terminate ? this.terminate("Sensor ID has no value between 1 and 20", 0) : process.exit(0);
        }

        if (username.trim().length === 0 || passwort.trim().length === 0) {
            this.log.error("User email and/or user password empty - please check instance configuration");
            this.terminate ? this.terminate("User email and/or user password empty - please check instance configuration", 0) : process.exit(0);
        }
        if (mqtt_active) {
            if (broker_address.trim().length === 0 || broker_address == "0.0.0.0") {
                this.log.error("MQTT IP address is empty - please check instance configuration");
                this.terminate ? this.terminate("MQTT IP address is empty - please check instance configuration", 0) : process.exit(0);
            }
            this.client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
                connectTimeout: 4000,
                username: mqtt_user,
                password: mqtt_pass
            });
        }

        try {
            const instObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
            if (instObj && instObj.common && instObj.common.schedule && instObj.common.schedule === "0 */3 * * *") {
                instObj.common.schedule = `${Math.floor(Math.random() * 60)} */3 * * *`;
                this.log.info(`Default schedule found and adjusted to spread calls better over the full hour!`);
                await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, instObj);
                this.terminate ? this.terminate() : process.exit(0);
                return;
            }
        } catch (err) {
            this.log.error(`Could not check or adjust the schedule: ${err.message}`);
        }

        this.log.debug("MQTT active: " + mqtt_active);
        this.log.debug("MQTT port: " + mqtt_port);
        const dataReceived = await this.main(this.client, username, passwort, mqtt_active, sensor_id, storeJson, storeDir);
        if (dataReceived === true) {
            // Items
            for (let n = 0; n < this.topic1.length; n++) {
                await this.setObjectNotExistsAsync(sensor_id + ".Items." + this.topic1[n], {
                    type: "state",
                    common: {
                        name: this.topic1[n],
                        type: this.typTopic1[n],
                        role: this.roleTopic1[n],
                        unit: this.unitTopic1[n],
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".Items." + this.topic1[n], { val: this.inhaltTopic1[n], ack: true });
            }

            // PricingForecast
            for (let n = 0; n < this.topic2.length; n++) {
                await this.setObjectNotExistsAsync(sensor_id + ".PricingForecast." + this.topic2[n], {
                    type: "state",
                    common: {
                        name: this.topic2[n],
                        type: this.typTopic2[n],
                        role: this.roleTopic2[n],
                        unit: this.unitTopic2[n],
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".PricingForecast." + this.topic2[n], { val: this.inhaltTopic2[n], ack: true });
            }

            // RemainsUntilCombined
            for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
                await this.setObjectNotExistsAsync(sensor_id + ".RemainsUntilCombined." + this.RemainsUntilCombined[n], {
                    type: "state",
                    common: {
                        name: this.RemainsUntilCombined[n],
                        type: this.typRemainsUntilCombined[n],
                        role: this.roleRemainsUntilCombined[n],
                        unit: this.unitRemainsUntilCombined[n],
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".RemainsUntilCombined." + this.RemainsUntilCombined[n], { val: this.inhaltRemainsUntilCombined[n], ack: true });
            }
        } else {
            await this.setObjectNotExistsAsync(sensor_id + ".Items." + this.topic1[0], {
                type: "state",
                common: {
                    name: this.topic1[0],
                    type: "boolean",
                    role: "indicator",
                    read: true,
                    write: false
                },
                native: {},
            });
            await this.setStateAsync(sensor_id + ".Items." + this.topic1[0], { val: false, ack: true });
            this.log.error("No data received");
            this.terminate ? this.terminate("No data received", 1) : process.exit(1);
        }

        // Finished - stopping instance
        this.terminate ? this.terminate("Everything done. Going to terminate till next schedule", 0) : process.exit(0);
    }

    async mqtt_send(sensor_id, mqtt_active, client, topic, wert) {
        if (mqtt_active) {
            client.publish("MEX/"+ sensor_id + "/" + topic, wert);
        }
    }

    async login(username, passwort) {
        this.log.debug("Login in...");
        this.username = username;
        this.passwort = passwort;
        this.url = "https://api.heizoel24.de/app/api/app/Login";
        this.newHeaders = { "Content-type": "application/json" };
        try {
            const reply = await axios.post(this.url, { "Password": this.passwort, "Username": this.username }, { headers: this.newHeaders });
            if (reply.status === 200) {
                this.log.debug("Login OK");
                const reply_json = reply.data;
                if (reply_json["ResultCode"] === 0) {
                    const session_id = reply_json["SessionId"];
                    this.log.debug("Session ID: " + session_id);
                    this.log.debug("Logged in");
                    return [true, session_id];
                } else {
                    this.log.error("ResultCode not 0. No session ID received!");
                }
            }
        } catch (error) {
            this.log.error("Login failed! Error: " + error.response.status);
            this.terminate ? this.terminate("Login failed!", 1) : process.exit(1);
        }
        return [false, ""];
    }

    async measurement(sensor_id, session_id) {
        this.log.debug("Get future residual oil levels...");
        const url = `https://api.heizoel24.de/app/api/app/measurement/CalculateRemaining/${session_id}/${sensor_id}/False`;
        try {
            const reply = await axios.get(url);
            if (reply.status === 200) {
                this.log.debug("Future residual oil levels received");
                return reply.data;
            } else {
                this.log.debug("Heizoel24 residual oil levels > Status Code: " + reply.status);
                return "error";
            }
        } catch (error) {
            this.log.error("Error fetching data: " + error.response.status);
            return "error";
        }
    }

    async mex(username, passwort) {
        const [login_status, session_id] = await this.login(username, passwort);
        if (!login_status) {
            return [false, false];
        }
        this.log.debug("Refresh sensor data cache...");
        const url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/1/False`;
        try {
            const reply = await axios.get(url);
            if (reply.status === 200) {
                this.log.debug("Data was received");
                return [reply, session_id];
            }
        } catch (error) {
            this.log.error("Error when fetching dashboard data. Error: " + error.response.status);
            this.terminate ? this.terminate("Error when fetching dashboard!", 1) : process.exit(1);
        }
        return [false, false];
    }

    async main(client, username, passwort, mqtt_active, sensor_id, storeJson, storeDir) {
        const [daten, session_id] = await this.mex(username, passwort);
        if (daten === false) {
            this.log.error("No data received");
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "Items/DataReceived", "false");
                client.end();
            }
            return false;
        }

        const datenJson = daten.data;

        for (let n = 0; n < this.topic2.length; n++) {
            const result = datenJson[this.topic2[n]] || false;
            this.inhaltTopic2[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "PricingForecast/" + this.topic2[n], result.toString());
            }
            this.log.debug("PricingForecast: " + this.topic2[n] + ": " + result.toString() + ", unit: " + this.unitTopic2[n] + ", Typ: " + (typeof datenJson[this.topic2[n]]));
        }

        const items = datenJson["Items"][0];

        for (let n = 1; n < this.topic1.length; n++) {
            const result = items[this.topic1[n]] || false;
            this.inhaltTopic1[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "Items/" + this.topic1[n], result.toString());
            }
            this.log.debug("Items: " + this.topic1[n] + ": " + result.toString() + ", unit: " + this.unitTopic1[n] + ", Typ: " + (typeof result));
        }
        if (mqtt_active) {
            await this.mqtt_send(sensor_id, mqtt_active, client, "Items/DataReceived", "true");
        }
        this.inhaltTopic1[0] = true;

        const daten3 = items["RemainsUntilCombined"];

        for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
            const result = daten3[this.RemainsUntilCombined[n]] || false;
            this.inhaltRemainsUntilCombined[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "RemainsUntilCombined/" + this.RemainsUntilCombined[n], result.toString());
            }
            this.log.debug("RemainsUntilCombined: " + this.RemainsUntilCombined[n] + ": " + result.toString() + ", unit: " + this.unitRemainsUntilCombined[n] + ", Typ: " + (typeof daten3[this.RemainsUntilCombined[n]]));
        }

        const sensorId = this.inhaltTopic1[1]; // get SensorId
        let zukunftsDaten = await this.measurement(sensorId, session_id);
        if (zukunftsDaten === "error") {
            this.log.debug("Error. No data received.");
            return false;
        }

        if (storeJson) {
            try {
                const json = JSON.stringify(zukunftsDaten);
                fs.writeFileSync(storeDir + "/oelstand.json", json, "utf8");
            } catch (error) {
                this.log.warn("Json file not saved");
            }
        }

        zukunftsDaten = zukunftsDaten["ConsumptionCurveResult"];

        let n = 0;
        for (const key in zukunftsDaten) {
            const datum = key.split("T")[0];
            this.datum = datum;
            if (n % 14 == 0) {
                if (n % 56 == 0) {
                    this.log.debug(datum + " " + zukunftsDaten[key] + " Liter remaining");
                }
                if (mqtt_active) {
                    await this.mqtt_send(sensor_id, mqtt_active, client, "CalculatedRemaining/" + String(n).padStart(5, "0") + ".date", datum);
                    await this.mqtt_send(sensor_id, mqtt_active, client, "CalculatedRemaining/" + String(n).padStart(5, "0") + ".liter", zukunftsDaten[key].toString());
                }

                await this.setObjectNotExistsAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Date", {
                    type: "state",
                    common: {
                        name: "Date",
                        type: "string",
                        role: "date",
                        unit: "",
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Date", { val: datum, ack: true });

                await this.setObjectNotExistsAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Liter", {
                    type: "state",
                    common: {
                        name: "Liter",
                        type: "number",
                        role: "value",
                        unit: "L",
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Liter", { val: zukunftsDaten[key], ack: true });
            }
            n++;
        }

        if (mqtt_active) {
            client.end();
        }

        for (n; n < 736; n++) {
            if (n % 14 == 0) {
                if (n % 56 == 0) {
                    this.log.debug("Data point " + String(n).padStart(5, "0") + " set to 0 liter");
                }
                await this.setObjectNotExistsAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Date", {
                    type: "state",
                    common: {
                        name: "Date",
                        type: "string",
                        role: "date",
                        unit: "",
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Date", { val: this.datum, ack: true });

                await this.setObjectNotExistsAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Liter", {
                    type: "state",
                    common: {
                        name: "Liter",
                        type: "number",
                        role: "value",
                        unit: "L",
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".CalculatedRemaining." + String(n).padStart(5, "0") + ".Liter", { val: 0, ack: true });
            }
        }
        return true;
    }

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
}

if (require.main !== module) {
    module.exports = (options) => new Heizoel24Mex(options);
} else {
    new Heizoel24Mex();
}

