"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.2
 */

const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const mqtt = require("mqtt");

class Heizoel24Mex extends utils.Adapter {

    constructor(options) {
        super({
            ...options,
            name: "heizoel24-mex",
        });
        this.debug = false;
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.topic1 = ["DataReceived", "SensorId", "IsMain", "CurrentVolumePercentage", "CurrentVolume", "NotifyAtLowLevel", "NotifyAtAlmostEmptyLevel", "NotificationsEnabled", "Usage", "RemainsUntil", "MaxVolume", "ZipCode", "MexName", "LastMeasurementTimeStamp", "LastMeasurementWithDifferentValue", "BatteryPercentage", "Battery", "LitresPerCentimeter", "LastMeasurementWasSuccessfully", "SensorTypeId", "HasMeasurements", "MeasuredDaysCount", "LastMeasurementWasTooHigh", "YearlyOilUsage", "RemainingDays", "LastOrderPrice", "ResultCode", "ResultMessage"];
        this.topic2 = ["LastOrderPrice", "PriceComparedToYesterdayPercentage", "PriceForecastPercentage", "HasMultipleMexDevices", "DashboardViewMode", "ShowComparedToYesterday", "ShowForecast", "ResultCode", "ResultMessage"];
        this.RemainsUntilCombined = ["MonthAndYear", "RemainsValue", "RemainsUnit"];
        this.inhaltTopic1 = [];
        this.inhaltTopic2 = [];
        this.inhaltRemainsUntilCombined = [];
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
        this.debug = this.config.debug;

        if (username == "" || passwort == "") {
            await this.log.error("User email and/or user password empty - please check instance configuration");
            this.terminate ? this.terminate("User email and/or user password empty - please check instance configuration", 0) : process.exit(0);
        }
        if (mqtt_active) {
            if (broker_address == "" || broker_address == "0.0.0.0") {
                await this.log.error("MQTT IP address is empty - please check instance configuration");
                this.terminate ? this.terminate("MQTT IP address is empty - please check instance configuration", 0) : process.exit(0);
            }
            this.client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
                username: mqtt_user,
                password: mqtt_pass
            });
        } else {
            this.client = "dummy";
        }
        if (this.debug) {
            await this.log.info("MQTT broker address: " + broker_address);
            await this.log.info("MQTT active: " + mqtt_active);
            await this.log.info("MQTT port: " + mqtt_port);
            await this.log.info("Detailed logging: " + this.debug);
        }
        const dataReceived = await this.main(this.client, username, passwort, mqtt_active);
        if (dataReceived === true) {
            // Items
            for (let n = 0; n < this.topic1.length; n++) {
                const typ = typeof this.inhaltTopic1[n];
                await this.setObjectNotExistsAsync("Items." + this.topic1[n], {
                    type: "state",
                    common: {
                        name: this.topic1[n],
                        type: typ,
                        role: typ,
                        read: true,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync("Items." + this.topic1[n], { val: this.inhaltTopic1[n], ack: true });
            }

            // PricingForecast
            for (let n = 0; n < this.topic2.length; n++) {
                const typ = typeof this.inhaltTopic2[n];
                await this.setObjectNotExistsAsync("PricingForecast." + this.topic2[n], {
                    type: "state",
                    common: {
                        name: this.topic2[n],
                        type: typ,
                        role: typ,
                        read: true,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync("PricingForecast." + this.topic2[n], { val: this.inhaltTopic2[n], ack: true });
            }

            // RemainsUntilCombined
            for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
                const typ = typeof this.inhaltRemainsUntilCombined[n];
                await this.setObjectNotExistsAsync("RemainsUntilCombined." + this.RemainsUntilCombined[n], {
                    type: "state",
                    common: {
                        name: this.RemainsUntilCombined[n],
                        type: typ,
                        role: typ,
                        read: true,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync("RemainsUntilCombined." + this.RemainsUntilCombined[n], { val: this.inhaltRemainsUntilCombined[n], ack: true });
            }
        } else {
            await this.setObjectNotExistsAsync("Items." + this.topic1[0], {
                type: "state",
                common: {
                    name: this.topic1[0],
                    type: "boolean",
                    role: "boolean",
                    read: true,
                    write: true,
                },
                native: {},
            });
            await this.setStateAsync("Items." + this.topic1[0], { val: false, ack: true });
            await this.log.error("No data received");
            this.terminate ? this.terminate("No data received", 1) : process.exit(1);
        }

        // Finished - stopping instance
        this.terminate ? this.terminate("Everything done. Going to terminate till next schedule", 0) : process.exit(0);
    }

    async mqtt_send(mqtt_active, client, topic, wert) {
        if (mqtt_active) {
            client.publish("MEX/" + topic, wert);
        }
    }

    async login(username, passwort) {
        if (this.debug) {
            await this.log.info("Login in...");
        }
        this.username = username;
        this.passwort = passwort;
        this.url = "https://api.heizoel24.de/app/api/app/Login";
        this.newHeaders = { "Content-type": "application/json" };
        try {
            const reply = await axios.post(this.url, { "Password": this.passwort, "Username": this.username }, { headers: this.newHeaders });
            if (reply.status === 200) {
                if (this.debug) {
                    await this.log.info("Login OK");
                }
                const reply_json = reply.data;
                if (reply_json["ResultCode"] === 0) {
                    const session_id = reply_json["SessionId"];
                    if (this.debug) {
                        await this.log.info("Session ID: " + session_id);
                        await this.log.info("Logged in");
                    }
                    return [true, session_id];
                } else {
                    await this.log.error("ResultCode not 0. No session ID received!");
                }
            }
        } catch (error) {
            await this.log.error("Login failed!");
        }
        return [false, ""];
    }

    async mex(username, passwort) {
        const [login_status, session_id] = await this.login(username, passwort);
        if (!login_status) {
            return false;
        }
        if (this.debug) {
            await this.log.info("Refresh sensor data cache...");
        }
        this.url = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/1/1/False`;
        try {
            const reply = await axios.get(this.url);
            if (reply.status === 200) {
                if (this.debug) {
                    await this.log.info("Data was received");
                }
                return reply;
            }
        } catch (error) {
            await this.log.error("Error when fetching dashboard data");
        }
        return false;
    }

    async main(client, username, passwort, mqtt_active) {
        const daten = await this.mex(username, passwort);
        if (daten === false) {
            await this.log.error("No data received");
            if (mqtt_active) {
                await this.mqtt_send(mqtt_active, client, "Items/DataReceived", "false");
                client.end();
            }
            return false;
        }

        const datenJson = daten.data;

        for (let n = 0; n < this.topic2.length; n++) {
            if (this.debug) {
                await this.log.info("PricingForecast: " + this.topic2[n] + ": " + datenJson[this.topic2[n]] + ", Typ: " + (typeof datenJson[this.topic2[n]]));
            }
            const result = datenJson[this.topic2[n]] || "---";
            this.inhaltTopic2[n] = result;
            await this.mqtt_send(mqtt_active, client, "PricingForecast/" + this.topic2[n], result.toString());
        }

        const items = datenJson["Items"][0];

        for (let n = 0; n < this.topic1.length; n++) {
            if (this.debug) {
                await this.log.info("Items: " + this.topic1[n] + ": " + items[this.topic1[n]] + ", Typ: " + (typeof items[this.topic1[n]]));
            }
            const result = items[this.topic1[n]] || "---";
            this.inhaltTopic1[n] = result;
            await this.mqtt_send(mqtt_active, client, "Items/" + this.topic1[n], result.toString());
        }
        await this.mqtt_send(mqtt_active, client, "Items/DataReceived", "true");
        this.inhaltTopic1[0] = true;

        const daten3 = items["RemainsUntilCombined"];

        for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
            if (this.debug) {
                await this.log.info("RemainsUntilCombined: " + this.RemainsUntilCombined[n] + ": " + daten3[this.RemainsUntilCombined[n]] + ", Typ: " + (typeof daten3[this.RemainsUntilCombined[n]]));
            }
            const result = daten3[this.RemainsUntilCombined[n]] || "---";
            this.inhaltRemainsUntilCombined[n] = result;
            await this.mqtt_send(mqtt_active, client, "RemainsUntilCombined/" + this.RemainsUntilCombined[n], result.toString());
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

