'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.2
 */

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const mqtt = require('mqtt');
const fs = require('node:fs');

axios.defaults.timeout = 2000;

class Heizoel24Mex extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'heizoel24-mex',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));

        this.Items = [
            { id: 'DataReceived', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'SensorId', role: 'value', unit: '', type: 'number' },
            { id: 'IsMain', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'CurrentVolumePercentage', role: 'level', unit: '%', type: 'number' },
            { id: 'CurrentVolume', role: 'level', unit: 'L', type: 'number' },
            { id: 'NotifyAtLowLevel', role: 'level.color.red', unit: '%', type: 'number' },
            { id: 'NotifyAtAlmostEmptyLevel', role: 'level.color.red', unit: '%', type: 'number' },
            { id: 'NotificationsEnabled', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'Usage', role: 'value', unit: 'L/Day', type: 'number' },
            { id: 'RemainsUntil', role: 'date', unit: '', type: 'string' },
            { id: 'MaxVolume', role: 'level.max', unit: 'L', type: 'number' },
            { id: 'ZipCode', role: 'value', unit: '', type: 'string' },
            { id: 'MexName', role: 'value', unit: '', type: 'string' },
            { id: 'LastMeasurementTimeStamp', role: 'date', unit: '', type: 'string' },
            { id: 'LastMeasurementWithDifferentValue', role: 'date', unit: '', type: 'string' },
            { id: 'BatteryPercentage', role: 'value.battery', unit: '%', type: 'number' },
            { id: 'Battery', role: 'value.battery', unit: 'V', type: 'number' },
            { id: 'LitresPerCentimeter', role: 'value', unit: 'L/cm', type: 'number' },
            { id: 'LastMeasurementWasSuccessfully', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'SensorTypeId', role: 'value', unit: '', type: 'number' },
            { id: 'HasMeasurements', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'MeasuredDaysCount', role: 'value', unit: 'Days', type: 'number' },
            { id: 'LastMeasurementWasTooHigh', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'YearlyOilUsage', role: 'value', unit: 'L', type: 'number' },
            { id: 'RemainingDays', role: 'value', unit: 'Days', type: 'number' },
            { id: 'LastOrderPrice', role: 'value', unit: '€|CHF', type: 'number' },
            { id: 'ResultCode', role: 'value', unit: '', type: 'boolean' },
            { id: 'ResultMessage', role: 'value', unit: '', type: 'boolean' },
            { id: 'LowBattery', role: 'indicator', unit: '', type: 'boolean' },
        ];

        this.PricingForecast = [
            { id: 'LastOrderPrice', role: 'value', unit: '€|CHF/100L', type: 'number' },
            { id: 'PriceComparedToYesterdayPercentage', role: 'value', unit: '%', type: 'number' },
            { id: 'PriceForecastPercentage', role: 'value', unit: '%', type: 'number' },
            { id: 'HasMultipleMexDevices', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'DashboardViewMode', role: 'value', unit: '', type: 'number' },
            { id: 'ShowComparedToYesterday', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'ShowForecast', role: 'indicator', unit: '', type: 'boolean' },
            { id: 'ResultCode', role: 'value', unit: '', type: 'boolean' },
            { id: 'ResultMessage', role: 'value', unit: '', type: 'boolean' },
        ];

        this.RemainsUntilCombined = [
            { id: 'MonthAndYear', role: 'value', unit: '', type: 'string' },
            { id: 'RemainsValue', role: 'value', unit: '', type: 'string' },
            { id: 'RemainsUnit', role: 'value', unit: '', type: 'string' },
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
        const sensor_in = this.config.sensor_id;
        let sensor_id = 1;
        const storeJson = this.config.storeJson;
        const storeDir = this.config.storeDir;

        if (Number(sensor_in)) {
            sensor_id = parseInt(sensor_in);
            if (sensor_id < 1 || sensor_id > 20) {
                this.log.error('Sensor ID has no value between 1 and 20');
                this.terminate ? this.terminate('Sensor ID has no value between 1 and 20', 0) : process.exit(0);
            }
        } else {
            this.log.error('Sensor ID has no valid value');
            this.terminate ? this.terminate('Sensor ID has no valid value', 0) : process.exit(0);
        }
        this.log.debug(`Sensor ID is ${sensor_id}`);

        if (username.trim().length === 0 || passwort.trim().length === 0) {
            this.log.error('User email and/or user password empty - please check instance configuration');
            this.terminate
                ? this.terminate('User email and/or user password empty - please check instance configuration', 0)
                : process.exit(0);
        }
        let client = null;
        if (mqtt_active) {
            if (broker_address.trim().length === 0 || broker_address == '0.0.0.0') {
                this.log.error('MQTT IP address is empty - please check instance configuration');
                this.terminate
                    ? this.terminate('MQTT IP address is empty - please check instance configuration', 0)
                    : process.exit(0);
            }
            client = mqtt.connect(`mqtt://${broker_address}:${mqtt_port}`, {
                connectTimeout: 4000,
                username: mqtt_user,
                password: mqtt_pass,
            });
        }

        try {
            const instObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
            if (instObj && instObj.common && instObj.common.schedule && instObj.common.schedule === '0 */3 * * *') {
                instObj.common.schedule = `${Math.floor(Math.random() * 60)} */3 * * *`;
                this.log.info(`Default schedule found and adjusted to spread calls better over the full hour!`);
                await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, instObj);
                this.terminate ? this.terminate() : process.exit(0);
                return;
            }
        } catch (err) {
            this.log.error(`Could not check or adjust the schedule: ${err.message}`);
        }

        this.log.debug(`MQTT active: ${mqtt_active}`);
        this.log.debug(`MQTT port: ${mqtt_port}`);
        const dataReceived = await this.mainRoutine(
            client,
            username,
            passwort,
            mqtt_active,
            sensor_id,
            storeJson,
            storeDir,
        );
        if (dataReceived === true) {
            await this.setObjectNotExistsAsync(sensor_id.toString(), {
                type: 'device',
                common: {
                    name: '',
                },
                native: {},
            });
            // Items
            await this.setObjectNotExistsAsync(`${sensor_id.toString()}.Items`, {
                type: 'channel',
                common: {
                    name: 'Items',
                },
                native: {},
            });
            for (let n = 0; n < this.Items.length; n++) {
                await this.setObjectNotExistsAsync(`${sensor_id.toString()}.Items.${this.Items[n].id}`, {
                    type: 'state',
                    common: {
                        name: this.Items[n].id,
                        type: this.Items[n].type,
                        role: this.Items[n].role,
                        unit: this.Items[n].unit,
                        read: true,
                        write: false,
                    },
                    native: {},
                });

                // If received boolean instead number, set it to -999999
                if (this.contentItems[n] === false && this.Items[n].type === 'number') {
                    this.contentItems[n] = -999999;
                    this.log.warn(`${this.Items[n].id} == false. Set it to -999999`);
                }

                // If received boolean instead string, set it to ---
                if (this.contentItems[n] === false && this.Items[n].type === 'string') {
                    this.contentItems[n] = '---';
                    this.log.warn(`${this.Items[n].id} == false. Set it to ---`);
                }

                await this.setStateAsync(`${sensor_id.toString()}.Items.${this.Items[n].id}`, {
                    val: this.contentItems[n],
                    ack: true,
                });
            }

            // PricingForecast
            await this.setObjectNotExistsAsync(`${sensor_id.toString()}.PricingForecast`, {
                type: 'channel',
                common: {
                    name: 'PricingForecast',
                },
                native: {},
            });
            for (let n = 0; n < this.PricingForecast.length; n++) {
                await this.setObjectNotExistsAsync(
                    `${sensor_id.toString()}.PricingForecast.${this.PricingForecast[n].id}`,
                    {
                        type: 'state',
                        common: {
                            name: this.PricingForecast[n].name,
                            type: this.PricingForecast[n].type,
                            role: this.PricingForecast[n].role,
                            unit: this.PricingForecast[n].unit,
                            read: true,
                            write: false,
                        },
                        native: {},
                    },
                );

                if (
                    this.contentPricingForecast[n] == false &&
                    (this.PricingForecast[n].id == 'PriceComparedToYesterdayPercentage' ||
                        this.PricingForecast[n].id == 'PriceForecastPercentage')
                ) {
                    this.log.debug(`${this.PricingForecast[n].id} omitted, because it's false`);
                } else {
                    await this.setStateAsync(`${sensor_id.toString()}.PricingForecast.${this.PricingForecast[n].id}`, {
                        val: this.contentPricingForecast[n],
                        ack: true,
                    });
                }
            }

            // RemainsUntilCombined
            await this.setObjectNotExistsAsync(`${sensor_id.toString()}.RemainsUntilCombined`, {
                type: 'channel',
                common: {
                    name: 'RemainsUntilCombined',
                },
                native: {},
            });
            for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
                await this.setObjectNotExistsAsync(
                    `${sensor_id.toString()}.RemainsUntilCombined.${this.RemainsUntilCombined[n].id}`,
                    {
                        type: 'state',
                        common: {
                            name: this.RemainsUntilCombined[n].id,
                            type: this.RemainsUntilCombined[n].type,
                            role: this.RemainsUntilCombined[n].role,
                            unit: this.RemainsUntilCombined[n].unit,
                            read: true,
                            write: false,
                        },
                        native: {},
                    },
                );
                await this.setStateAsync(
                    `${sensor_id.toString()}.RemainsUntilCombined.${this.RemainsUntilCombined[n].id}`,
                    { val: this.contentRemainsUntilCombined[n], ack: true },
                );
            }
        } else {
            await this.setObjectNotExistsAsync(`${sensor_id.toString()}.Items.${this.Items[0].id}`, {
                type: 'state',
                common: {
                    name: this.Items[0].id,
                    type: 'boolean',
                    role: 'indicator',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.setStateAsync(`${sensor_id.toString()}.Items.${this.Items[0].id}`, { val: false, ack: true });
            this.log.error('No data received');
            this.terminate ? this.terminate('No data received', 1) : process.exit(1);
        }

        // Finished - stopping instance
        this.terminate ? this.terminate('Everything done. Going to terminate till next schedule', 0) : process.exit(0);
    }

    async sendMqtt(sensor_id, mqtt_active, client, topic, wert) {
        if (mqtt_active) {
            client.publish(`MEX/${sensor_id.toString()}/${topic}`, wert);
        }
    }

    async login(username, passwort) {
        this.log.debug('Login in...');
        this.username = username;
        this.passwort = passwort;
        this.url = 'https://api.heizoel24.de/app/api/app/Login';
        this.newHeaders = { 'Content-type': 'application/json' };
        try {
            const reply = await axios.post(
                this.url,
                { Password: this.passwort, Username: this.username },
                { headers: this.newHeaders },
            );
            if (reply.status === 200) {
                this.log.debug('Login OK');
                const reply_json = reply.data;
                if (reply_json['ResultCode'] === 0) {
                    const session_id = reply_json['SessionId'];
                    this.log.debug(`Session ID: ${session_id}`);
                    this.log.debug('Logged in');
                    return [true, session_id];
                }
                this.log.error('ResultCode not 0. No session ID received!');
            }
        } catch (error) {
            this.log.error(`Login failed! Error: ${error.response.status}`);
            this.terminate ? this.terminate('Login failed!', 1) : process.exit(1);
        }
        return [false, ''];
    }

    async getCalculateRemaining(sensor_id, session_id) {
        this.log.debug('Get future residual oil levels...');
        const url = `https://api.heizoel24.de/app/api/app/measurement/CalculateRemaining/${session_id}/${sensor_id}/False`;
        try {
            const reply = await axios.get(url);
            if (reply.status === 200) {
                this.log.debug('Future residual oil levels received');
                return reply.data;
            }
            this.log.debug(`Heizoel24 residual oil levels > Status Code: ${reply.status}`);
            return 'error';
        } catch (error) {
            this.log.error(`Error fetching data: ${error.response.status}`);
            return 'error';
        }
    }

    async getMexData(username, passwort, sensor_id) {
        const [login_status, session_id] = await this.login(username, passwort);
        if (!login_status) {
            return [false, false, false];
        }

        this.log.debug('Refresh sensor data cache...');

        const url1 = `https://api.heizoel24.de/app/api/app/GetDashboardData/${session_id}/2/${sensor_id}/False`;
        const url2 = `https://api.heizoel24.de/app/api/app/GetOilUsage/${session_id}/False`;

        try {
            const reply1 = await axios.get(url1);
            if (reply1.status !== 200) {
                this.log.error('Dashboard data unsuccessful.');
                return [false, false, false];
            }

            let reply2 = false;
            try {
                const r2 = await axios.get(url2);
                if (r2.status === 200) {
                    reply2 = r2.data;
                } else {
                    this.log.warn('Oil consumption could not be loaded (status ≠ 200).');
                }
            } catch (e) {
                this.log.warn(`Error retrieving oil consumption: ${e?.response?.status || e.message}`);
            }

            this.log.debug('Dashboard data successfully received.');
            return [reply1.data, reply2, session_id];
        } catch (error) {
            const status = error?.response?.status || 'unknown';
            this.log.error(`Error retrieving dashboard data. Status: ${status}`);
            this.terminate ? this.terminate('Error retrieving dashboard data!', 1) : process.exit(1);
        }

        return [false, false, false];
    }

    async mainRoutine(client, username, passwort, mqtt_active, sensor_id, storeJson, storeDir) {
        const [daten, oil_usage, session_id] = await this.getMexData(username, passwort, sensor_id);
        if (daten === false) {
            this.log.error('No data received');
            if (mqtt_active) {
                await this.sendMqtt(sensor_id, mqtt_active, client, 'Items/DataReceived', 'false');
                client.end();
            }
            return false;
        }

        const datenJson = daten;

        for (let n = 0; n < this.PricingForecast.length; n++) {
            const result = datenJson[this.PricingForecast[n].id] || false;
            this.contentPricingForecast[n] = result;
            if (mqtt_active) {
                if (
                    this.contentPricingForecast[n] == false &&
                    (this.PricingForecast[n].id == 'PriceComparedToYesterdayPercentage' ||
                        this.PricingForecast[n].id == 'PriceForecastPercentage')
                ) {
                    this.log.debug(`${this.PricingForecast[n].id} omitted, because it's false`);
                } else {
                    await this.sendMqtt(
                        sensor_id,
                        mqtt_active,
                        client,
                        `PricingForecast/${this.PricingForecast[n].id}`,
                        result.toString(),
                    );
                }
            }
            this.log.debug(
                `PricingForecast: ${this.PricingForecast[n].id}: ${result.toString()}, unit: ${
                    this.PricingForecast[n].unit
                }, Typ: ${typeof datenJson[this.PricingForecast[n].id]}`,
            );
        }

        const items = datenJson['Items'][0];

        // Rohwert von Batteriespannung holen
        const rawBattery = datenJson?.Items?.[0]?.Battery;

        // Nur akzeptieren, wenn eine gültige Zahl ist
        const batteryVoltage = typeof rawBattery === 'number' && Number.isFinite(rawBattery) ? rawBattery : null;

        // Alles Unerwartete = true
        const lowBattery = batteryVoltage === null || batteryVoltage < 2.5;

        for (let n = 1; n < this.Items.length; n++) {
            const result = items[this.Items[n].id] || false;
            this.contentItems[n] = result;
            if (mqtt_active) {
                await this.sendMqtt(sensor_id, mqtt_active, client, `Items/${this.Items[n].id}`, result.toString());
            }
            this.log.debug(
                `Items: ${this.Items[n].id}: ${result.toString()}, unit: ${this.Items[n].unit}, Typ: ${typeof result}`,
            );
        }

        // LowBattery an der richtigen Position speichern
        const lowBatteryIndex = this.Items.findIndex(i => i.id === 'LowBattery');
        this.contentItems[lowBatteryIndex] = lowBattery;

        if (mqtt_active) {
            await this.sendMqtt(sensor_id, mqtt_active, client, 'Items/DataReceived', 'true');
            await this.sendMqtt(sensor_id, mqtt_active, client, 'Items/LowBattery', String(lowBattery));
        }

        const dataReceivedIndex = this.Items.findIndex(i => i.id === 'DataReceived');
        this.contentItems[dataReceivedIndex] = true;

        const daten3 = items['RemainsUntilCombined'];

        for (let n = 0; n < this.RemainsUntilCombined.length; n++) {
            let result = 'empty';
            try {
                result = daten3[this.RemainsUntilCombined[n].id] || false;
            } catch {
                this.log.debug('RemainsUntilCombined no data found');
            }
            this.contentRemainsUntilCombined[n] = result;
            try {
                if (mqtt_active) {
                    await this.sendMqtt(
                        sensor_id,
                        mqtt_active,
                        client,
                        `RemainsUntilCombined/${this.RemainsUntilCombined[n].id}`,
                        result.toString(),
                    );
                }
                this.log.debug(
                    `RemainsUntilCombined: ${this.RemainsUntilCombined[n].id}: ${result.toString()}, unit: ${
                        this.RemainsUntilCombined[n].unit
                    }, Typ: ${typeof daten3[this.RemainsUntilCombined[n].id]}`,
                );
            } catch {
                this.log.debug('RemainsUntilCombined no data found');
            }
        }

        const sensorId = this.contentItems[1]; // get SensorId
        let zukunftsDaten = await this.getCalculateRemaining(sensorId, session_id);
        if (zukunftsDaten === 'error') {
            this.log.debug('Error. No data received.');
            return false;
        }

        if (storeJson) {
            try {
                const json = JSON.stringify(zukunftsDaten, null, 4);
                fs.writeFileSync(`${storeDir}/calculatedRemaining.json`, json, 'utf8');
            } catch {
                this.log.warn(
                    'calculatedRemaining.json file not saved. Have ioBroker write permissions in the specified folder?',
                );
            }
            if (oil_usage) {
                try {
                    const oilJson = JSON.stringify(oil_usage, null, 4);
                    fs.writeFileSync(`${storeDir}/oilUsage.json`, oilJson, 'utf8');
                } catch {
                    this.log.warn(
                        'oilUsage.json file not saved. Have ioBroker write permissions in the specified folder?',
                    );
                }
            } else {
                this.log.warn('OilUsage data not available! oilUsage.json file was not saved.');
            }
            try {
                const data1 = JSON.stringify(daten, null, 4);
                fs.writeFileSync(`${storeDir}/jsonData.json`, data1, 'utf8');
            } catch {
                this.log.warn('jsonData.json file not saved. Have ioBroker write permissions in the specified folder?');
            }
        }

        await this.setObjectNotExistsAsync(`${sensor_id.toString()}.CalculatedRemaining`, {
            type: 'channel',
            common: {
                name: 'CalculatedRemaining',
            },
            native: {},
        });

        zukunftsDaten = zukunftsDaten['ConsumptionCurveResult'];
        let jsonData = '[\n';
        let unixTimestamp = 0;
        let key = '';
        let datum = '';

        let n = 0;
        for (key in zukunftsDaten) {
            datum = key.split('T')[0];
            if (n % 14 == 0) {
                // Only every 14 days
                if (mqtt_active) {
                    await this.sendMqtt(
                        sensor_id,
                        mqtt_active,
                        client,
                        `CalculatedRemaining/Today+${String(n).padStart(4, '0')} Days.Date`,
                        datum,
                    );
                    await this.sendMqtt(
                        sensor_id,
                        mqtt_active,
                        client,
                        `CalculatedRemaining/Today+${String(n).padStart(4, '0')} Days.Liter`,
                        zukunftsDaten[key].toString(),
                    );
                }
                unixTimestamp = new Date(datum).getTime() / 1000;
                jsonData = `${jsonData}    {"ts": ${unixTimestamp}, "val": ${zukunftsDaten[key].toString()}},\n`;
            }
            n++;
        }
        if (mqtt_active) {
            await this.sendMqtt(
                sensor_id,
                mqtt_active,
                client,
                `CalculatedRemaining/Today+${String(n).padStart(4, '0')} Days.Date`,
                datum,
            );
            try {
                await this.sendMqtt(
                    sensor_id,
                    mqtt_active,
                    client,
                    `CalculatedRemaining/Today+${String(n).padStart(4, '0')} Days.Liter`,
                    zukunftsDaten[key].toString(),
                );
            } catch {
                this.log.debug('CalculatedRemaining is empty');
            }
        }

        this.log.debug(`${n.toString()} future days saved`);
        unixTimestamp = new Date(datum).getTime() / 1000;
        try {
            jsonData = `${jsonData}    {"ts": ${unixTimestamp}, "val": ${zukunftsDaten[key].toString()}}\n]`;
        } catch {
            this.log.debug('CalculatedRemaining is empty');
        }

        await this.setObjectNotExistsAsync(`${sensor_id.toString()}.CalculatedRemaining.JsonForEcharts`, {
            type: 'state',
            common: {
                name: 'OilLevelsInTheFuture',
                type: 'string',
                role: 'value',
                unit: '',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setStateAsync(`${sensor_id.toString()}.CalculatedRemaining.JsonForEcharts`, {
            val: jsonData,
            ack: true,
        });

        // OilUsage verarbeiten und senden
        if (oil_usage && oil_usage['Values']) {
            const oilUsage = oil_usage['Values'];
            let oilJsonData = '[\n';
            let count = 0;

            for (const key in oilUsage) {
                const datum = key.split('T')[0];
                const liter = oilUsage[key];
                const unixTimestamp = new Date(datum).getTime() / 1000;

                if (mqtt_active) {
                    await this.sendMqtt(sensor_id, mqtt_active, client, `OilUsage/${datum}`, `${liter} Ltr.`);
                }

                oilJsonData += `    {"ts": ${unixTimestamp}, "val": ${liter}},\n`;
                count++;
            }

            this.log.debug(`${count.toString()} OilUsage-Einträge verarbeitet`);

            // Letztes Komma ersetzen
            if (count > 0) {
                oilJsonData = `${oilJsonData.trimEnd().replace(/,$/, '')}\n]`;
            } else {
                oilJsonData = '[]';
            }

            // ioBroker-Datenpunkt erstellen
            await this.setObjectNotExistsAsync(`${sensor_id.toString()}.OilUsage.JsonForEcharts`, {
                type: 'state',
                common: {
                    name: 'OilUsage over time',
                    type: 'string',
                    role: 'value',
                    unit: '',
                    read: true,
                    write: false,
                },
                native: {},
            });

            // Wert setzen
            await this.setStateAsync(`${sensor_id.toString()}.OilUsage.JsonForEcharts`, {
                val: oilJsonData,
                ack: true,
            });
        }

        if (mqtt_active) {
            client.end();
        }
        return true;
    }

    onUnload(callback) {
        try {
            callback();
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new Heizoel24Mex(options);
} else {
    new Heizoel24Mex();
}
