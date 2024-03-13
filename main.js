"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.2
 */

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const mqtt = require("mqtt");

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

        if (sensor_id < 1 || sensor_id > 20) {
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
        const dataReceived = await this.main(this.client, username, passwort, mqtt_active, sensor_id);
        if (dataReceived === true) {
            // Items
            for (let n = 0; n < this.topic1.length; n++) {
                const typ = typeof this.inhaltTopic1[n];
                await this.setObjectNotExistsAsync(sensor_id + ".Items." + this.topic1[n], {
                    type: "state",
                    common: {
                        name: this.topic1[n],
                        type: typ,
                        role: this.roleTopic1[n],
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".Items." + this.topic1[n], { val: this.inhaltTopic1[n], ack: true });
            }

            // PricingForecast
            for (let n = 0; n < this.topic2.length; n++) {
                const typ = typeof this.inhaltTopic2[n];
                await this.setObjectNotExistsAsync(sensor_id + ".PricingForecast." + this.topic2[n], {
                    type: "state",
                    common: {
                        name: this.topic2[n],
                        type: typ,
                        role: this.roleTopic2[n],
                        read: true,
                        write: false
                    },
                    native: {},
                });
                await this.setStateAsync(sensor_id + ".PricingForecast." + this.topic2[n], { val: this.inhaltTopic2[n], ack: true });
            }

            // RemainsUntilCombined
            for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
                const typ = typeof this.inhaltRemainsUntilCombined[n];
                await this.setObjectNotExistsAsync(sensor_id + ".RemainsUntilCombined." + this.RemainsUntilCombined[n], {
                    type: "state",
                    common: {
                        name: this.RemainsUntilCombined[n],
                        type: typ,
                        role: this.roleRemainsUntilCombined[n],
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

    async mex(username, passwort) {
        const [login_status, session_id] = await this.login(username, passwort);
        if (!login_status) {
            return false;
        }
        this.log.debug("Refresh sensor data cache...");
        this.url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/1/False`;
        try {
            const reply = await axios.get(this.url);
            if (reply.status === 200) {
                this.log.debug("Data was received");
                return reply;
            }
        } catch (error) {
            this.log.error("Error when fetching dashboard data. Error: " + error.response.status);
            this.terminate ? this.terminate("Error when fetching dashboard!", 1) : process.exit(1);
        }
        return false;
    }

    async main(client, username, passwort, mqtt_active, sensor_id) {
        const daten = await this.mex(username, passwort);
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
            this.log.debug("PricingForecast: " + this.topic2[n] + ": " + datenJson[this.topic2[n]] + ", Typ: " + (typeof datenJson[this.topic2[n]]));
            const result = datenJson[this.topic2[n]] || false;
            this.inhaltTopic2[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "PricingForecast/" + this.topic2[n], result.toString());
            }
        }

        const items = datenJson["Items"][0];

        for (let n = 1; n < this.topic1.length; n++) {
            const result = items[this.topic1[n]] || false;
            this.inhaltTopic1[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "Items/" + this.topic1[n], result.toString());
            }
            this.log.debug("Items: " + this.topic1[n] + ": " + result.toString() + ", Typ: " + (typeof result));
        }
        if (mqtt_active) {
            await this.mqtt_send(sensor_id, mqtt_active, client, "Items/DataReceived", "true");
        }
        this.inhaltTopic1[0] = true;

        const daten3 = items["RemainsUntilCombined"];

        for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
            this.log.debug("RemainsUntilCombined: " + this.RemainsUntilCombined[n] + ": " + daten3[this.RemainsUntilCombined[n]] + ", Typ: " + (typeof daten3[this.RemainsUntilCombined[n]]));
            const result = daten3[this.RemainsUntilCombined[n]] || false;
            this.inhaltRemainsUntilCombined[n] = result;
            if (mqtt_active) {
                await this.mqtt_send(sensor_id, mqtt_active, client, "RemainsUntilCombined/" + this.RemainsUntilCombined[n], result.toString());
            }
        }

        if (mqtt_active) {
            client.end();
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

