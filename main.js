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

        this.Items = [
            {
                id   : "DataReceived",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "SensorId",
                role : "value",
                unit : "",
                type : "number"
            },
            {
                id   : "IsMain",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "CurrentVolumePercentage",
                role : "level",
                unit : "%",
                type : "number"
            },
            {
                id   : "CurrentVolume",
                role : "level",
                unit : "L",
                type : "number"
            },
            {
                id   : "NotifyAtLowLevel",
                role : "level.color.red",
                unit : "%",
                type : "number"
            },
            {
                id   : "NotifyAtAlmostEmptyLevel",
                role : "level.color.red",
                unit : "%",
                type : "number"
            },
            {
                id   : "NotificationsEnabled",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "Usage",
                role : "value",
                unit : "L/Day",
                type : "number"
            },
            {
                id   : "RemainsUntil",
                role : "date",
                unit : "",
                type : "string"
            },
            {
                id   : "MaxVolume",
                role : "level.max",
                unit : "L",
                type : "number"
            },
            {
                id   : "ZipCode",
                role : "value",
                unit : "",
                type : "string"
            },
            {
                id   : "MexName",
                role : "value",
                unit : "",
                type : "string"
            },
            {
                id   : "LastMeasurementTimeStamp",
                role : "date",
                unit : "",
                type : "string"
            },
            {
                id   : "LastMeasurementWithDifferentValue",
                role : "date",
                unit : "",
                type : "string"
            },
            {
                id   : "BatteryPercentage",
                role : "value.battery",
                unit : "%",
                type : "number"
            },
            {
                id   : "Battery",
                role : "value.battery",
                unit : "V",
                type : "number"
            },
            {
                id   : "LitresPerCentimeter",
                role : "value",
                unit : "L/cm",
                type : "number"
            },
            {
                id   : "LastMeasurementWasSuccessfully",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "SensorTypeId",
                role : "value",
                unit : "",
                type : "number"
            },
            {
                id   : "HasMeasurements",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "MeasuredDaysCount",
                role : "value",
                unit : "Days",
                type : "number"
            },
            {
                id   : "LastMeasurementWasTooHigh",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "YearlyOilUsage",
                role : "value",
                unit : "L",
                type : "number"
            },
            {
                id   : "RemainingDays",
                role : "value",
                unit : "Days",
                type : "number"
            },
            {
                id   : "LastOrderPrice",
                role : "value",
                unit : "€|CHF",
                type : "number"
            },
            {
                id   : "ResultCode",
                role : "value",
                unit : "",
                type : "boolean"
            },
            {
                id   : "ResultMessage",
                role : "value",
                unit : "",
                type : "boolean"
            },
        ];

        this.PricingForecast = [
            {
                id   : "LastOrderPrice",
                role : "value",
                unit : "€|CHF/100L",
                type : "number"
            },
            {
                id   : "PriceComparedToYesterdayPercentage",
                role : "value",
                unit : "%",
                type : "number"
            },
            {
                id   : "PriceForecastPercentage",
                role : "value",
                unit : "%",
                type : "number"
            },
            {
                id   : "HasMultipleMexDevices",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "DashboardViewMode",
                role : "value",
                unit : "",
                type : "number"
            },
            {
                id   : "ShowComparedToYesterday",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "ShowForecast",
                role : "indicator",
                unit : "",
                type : "boolean"
            },
            {
                id   : "ResultCode",
                role : "value",
                unit : "",
                type : "boolean"
            },
            {
                id   : "ResultMessage",
                role : "value",
                unit : "",
                type : "boolean"
            },
        ];

        this.RemainsUntilCombined = [
            {
                id   : "MonthAndYear",
                role : "value",
                unit : "",
                type : "string"
            },
            {
                id   : "RemainsValue",
                role : "value",
                unit : "",
                type : "string"
            },
            {
                id   : "RemainsUnit",
                role : "value",
                unit : "",
                type : "string"
            },
        ];

        this.contentItems = [];
        this.contentPricingForecast = [];
        this.contentRemainsUntilCombined = [];
    }

    async onReady() {
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

        if (Number.isInteger(sensor_id)) {
            if (parseInt(sensor_id) < 1 || parseInt(sensor_id) > 20) {
                this.log.error("Sensor ID has no value between 1 and 20");
                this.terminate ? this.terminate("Sensor ID has no value between 1 and 20", 1) : process.exit(1);
            }
        } else {
            this.log.error("Sensor ID has no valid value");
            this.terminate ? this.terminate("Sensor ID has no valid value", 1) : process.exit(1);
        }
        this.log.debug("Sensor ID is " + sensor_id);

        if (username.trim().length === 0 || passwort.trim().length === 0) {
            this.log.error("User email and/or user password empty - please check instance configuration");
            this.terminate ? this.terminate("User email and/or user password empty - please check instance configuration", 1) : process.exit(1);
        }
        let client = null;
        if (mqtt_active) {
            if (broker_address.trim().length === 0 || broker_address == "0.0.0.0") {
                this.log.error("MQTT IP address is empty - please check instance configuration");
                this.terminate ? this.terminate("MQTT IP address is empty - please check instance configuration", 1) : process.exit(1);
            }
            client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
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
        const dataReceived = await this.main(client, username, passwort, mqtt_active, sensor_id, storeJson, storeDir);
        if (dataReceived === true) {
            await this.setObjectNotExistsAsync(sensor_id.toString(), {
                type: "device",
                common: {
                    name: ""
                },
                native: {},
            });
            // Items
            await this.setObjectNotExistsAsync(sensor_id.toString() + ".Items", {
                type: "channel",
                common: {
                    name: "Items"
                },
                native: {},
            });
            for (let n = 0; n < this.Items.length; n++) {
                // @ts-ignore
                await this.setObjectNotExistsAsync(sensor_id.toString() + ".Items." + this.Items[n].id, {
                    type: "state",
                    common: {
                        name: this.Items[n].id,
                        type: this.Items[n].type,
                        role: this.Items[n].role,
                        unit: this.Items[n].unit,
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id.toString() + ".Items." + this.Items[n].id, { val: this.contentItems[n], ack: true });
            }

            // PricingForecast
            await this.setObjectNotExistsAsync(sensor_id.toString() + ".PricingForecast", {
                type: "channel",
                common: {
                    name: "PricingForecast"
                },
                native: {},
            });
            for (let n = 0; n < this.PricingForecast.length; n++) {
                // @ts-ignore
                await this.setObjectNotExistsAsync(sensor_id.toString() + ".PricingForecast." + this.PricingForecast[n].id, {
                    type: "state",
                    common: {
                        name: this.PricingForecast[n].name,
                        type: this.PricingForecast[n].type,
                        role: this.PricingForecast[n].role,
                        unit: this.PricingForecast[n].unit,
                        read: true,
                        write: false
                    },
                    native: {},
                });

                if (this.contentPricingForecast[n] == false &&
                    (this.PricingForecast[n].id == "PriceComparedToYesterdayPercentage" ||
                    this.PricingForecast[n].id == "PriceForecastPercentage")) {
                    this.log.debug(this.PricingForecast[n].id + " omitted, while it's false");
                } else {
                    await this.setStateAsync(sensor_id.toString() + ".PricingForecast." + this.PricingForecast[n].id, { val: this.contentPricingForecast[n], ack: true });
                }
            }

            // RemainsUntilCombined
            await this.setObjectNotExistsAsync(sensor_id.toString() + ".RemainsUntilCombined", {
                type: "channel",
                common: {
                    name: "RemainsUntilCombined"
                },
                native: {},
            });
            for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
                // @ts-ignore
                await this.setObjectNotExistsAsync(sensor_id.toString() + ".RemainsUntilCombined." + this.RemainsUntilCombined[n].id, {
                    type: "state",
                    common: {
                        name: this.RemainsUntilCombined[n].id,
                        type: this.RemainsUntilCombined[n].type,
                        role: this.RemainsUntilCombined[n].role,
                        unit: this.RemainsUntilCombined[n].unit,
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id.toString() + ".RemainsUntilCombined." + this.RemainsUntilCombined[n].id, { val: this.contentRemainsUntilCombined[n], ack: true });
            }
        } else {
            await this.setObjectNotExistsAsync(sensor_id.toString() + ".Items." + this.Items[0].id, {
                type: "state",
                common: {
                    name: this.Items[0].id,
                    type: "boolean",
                    role: "indicator",
                    read: true,
                    write: false
                },
                native: {},
            });
            await this.setStateAsync(sensor_id.toString() + ".Items." + this.Items[0].id, { val: false, ack: true });
            this.log.error("No data received");
            this.terminate ? this.terminate("No data received", 1) : process.exit(1);
        }

        // Finished - stopping instance
        this.terminate ? this.terminate("Everything done. Going to terminate till next schedule", 0) : process.exit(0);
    }

    async sendMqtt(sensor_id, mqtt_active, client, topic, wert) {
        if (mqtt_active) {
            client.publish("MEX/"+ sensor_id.toString() + "/" + topic, wert);
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

    async mex(username, passwort, sensor_id) {
        const [login_status, session_id] = await this.login(username, passwort);
        if (!login_status) {
            return [false, false];
        }
        this.log.debug("Refresh sensor data cache...");
        const url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/${sensor_id}/False`;
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
        const [daten, session_id] = await this.mex(username, passwort, sensor_id);
        if (daten === false) {
            this.log.error("No data received");
            if (mqtt_active) {
                await this.sendMqtt(sensor_id, mqtt_active, client, "Items/DataReceived", "false");
                client.end();
            }
            return false;
        }

        const datenJson = daten.data;

        for (let n = 0; n < this.PricingForecast.length; n++) {
            const result = datenJson[this.PricingForecast[n].id] || false;
            this.contentPricingForecast[n] = result;
            if (mqtt_active) {
                if (this.contentPricingForecast[n] == false &&
                    (this.PricingForecast[n].id == "PriceComparedToYesterdayPercentage" ||
                    this.PricingForecast[n].id == "PriceForecastPercentage")) {
                    this.log.debug(this.PricingForecast[n].id + " omitted, while it's false");
                } else {
                    await this.sendMqtt(sensor_id, mqtt_active, client, "PricingForecast/" + this.PricingForecast[n].id, result.toString());
                }
            }
            this.log.debug("PricingForecast: " + this.PricingForecast[n].id + ": " + result.toString() + ", unit: " + this.PricingForecast[n].unit + ", Typ: " + (typeof datenJson[this.PricingForecast[n].id]));
        }

        const items = datenJson["Items"][0];

        for (let n = 1; n < this.Items.length; n++) {
            const result = items[this.Items[n].id] || false;
            this.contentItems[n] = result;
            if (mqtt_active) {
                await this.sendMqtt(sensor_id, mqtt_active, client, "Items/" + this.Items[n].id, result.toString());
            }
            this.log.debug("Items: " + this.Items[n].id + ": " + result.toString() + ", unit: " + this.Items[n].unit + ", Typ: " + (typeof result));
        }
        if (mqtt_active) {
            await this.sendMqtt(sensor_id, mqtt_active, client, "Items/DataReceived", "true");
        }
        this.contentItems[0] = true;

        const daten3 = items["RemainsUntilCombined"];

        for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
            const result = daten3[this.RemainsUntilCombined[n].id] || false;
            this.contentRemainsUntilCombined[n] = result;
            if (mqtt_active) {
                await this.sendMqtt(sensor_id, mqtt_active, client, "RemainsUntilCombined/" + this.RemainsUntilCombined[n].id, result.toString());
            }
            this.log.debug("RemainsUntilCombined: " + this.RemainsUntilCombined[n].id + ": " + result.toString() + ", unit: " + this.RemainsUntilCombined[n].unit + ", Typ: " + (typeof daten3[this.RemainsUntilCombined[n].id]));
        }

        const sensorId = this.contentItems[1]; // get SensorId
        let zukunftsDaten = await this.measurement(sensorId, session_id);
        if (zukunftsDaten === "error") {
            this.log.debug("Error. No data received.");
            return false;
        }

        if (storeJson) {
            try {
                const json = JSON.stringify(zukunftsDaten, null, 4);
                fs.writeFileSync(storeDir + "/CalculatedRemaining.json", json, "utf8");
            } catch (error) {
                this.log.warn("Json file not saved. Does ioBroker have write permissions in the specified folder?");
            }
        }

        await this.setObjectNotExistsAsync(sensor_id.toString() + ".CalculatedRemaining", {
            type: "channel",
            common: {
                name: "CalculatedRemaining"
            },
            native: {},
        });

        zukunftsDaten = zukunftsDaten["ConsumptionCurveResult"];
        let jsonData = "[\n";
        let unixTimestamp = 0;
        let key = "";
        let datum = "";

        let n = 0;
        for (key in zukunftsDaten) {
            datum = key.split("T")[0];
            if (n % 14 == 0) { // Only every 14 days
                if (mqtt_active) {
                    await this.sendMqtt(sensor_id, mqtt_active, client, "CalculatedRemaining/Today+" + String(n).padStart(4, "0") + " Days.Date", datum);
                    await this.sendMqtt(sensor_id, mqtt_active, client, "CalculatedRemaining/Today+" + String(n).padStart(4, "0") + " Days.Liter", zukunftsDaten[key].toString());
                }
                unixTimestamp = new Date(datum).getTime() / 1000;
                jsonData = jsonData + '    {"ts": ' + unixTimestamp + ', "val": ' + zukunftsDaten[key].toString() + "},\n";
            }
            n++;
        }
        if (mqtt_active) {
            await this.sendMqtt(sensor_id, mqtt_active, client, "CalculatedRemaining/Today+" + String(n).padStart(4, "0") + " Days.Date", datum);
            await this.sendMqtt(sensor_id, mqtt_active, client, "CalculatedRemaining/Today+" + String(n).padStart(4, "0") + " Days.Liter", zukunftsDaten[key].toString());
        }

        this.log.debug(n.toString() + " future days saved");
        jsonData = jsonData + '    {"ts": ' + unixTimestamp + ', "val": ' + zukunftsDaten[key].toString() + "}\n]";

        await this.setObjectNotExistsAsync(sensor_id.toString() + ".CalculatedRemaining.CalculatedRemainingJson", {
            type: "state",
            common: {
                name: "OilLevelsInTheFuture",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false
            },
            native: {},
        });
        await this.setStateAsync(sensor_id.toString() + ".CalculatedRemaining.CalculatedRemainingJson", { val: jsonData, ack: true });

        if (mqtt_active) {
            client.end();
        }
        return true;
    }

    onUnload(callback) {
        try {
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
