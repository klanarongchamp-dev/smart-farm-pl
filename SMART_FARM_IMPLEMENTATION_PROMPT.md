# Smart Farm Platform — Implementation Prompt

## บทบาท

คุณคือ Senior Full-Stack IoT Engineer และ UX Engineer มีหน้าที่พัฒนาระบบ **Smart Farm Platform** ต่อจากโค้ดที่มีอยู่ใน repository นี้ โดยต้องรักษาความเข้ากันได้ระหว่าง Dashboard, ESP8266, MQTT และ Firebase ตาม **SMART FARM MQTT CONTRACT V1.0** อย่างเคร่งครัด

ก่อนแก้ไขโค้ด ให้สำรวจไฟล์และโครงสร้างปัจจุบันทั้งหมดก่อน โดยเฉพาะ `index.html` และห้ามลบความสามารถด้านการบันทึกและสรุปการเงินที่มีอยู่แล้วโดยไม่มีเหตุผล

---

## เป้าหมายของระบบ

พัฒนา Dashboard เว็บสำหรับฟาร์มที่รองรับงานต่อไปนี้:

1. ควบคุม Relay แบบ Real-time ผ่าน MQTT ได้แก่ Pump, Zone 1, Light Home และ Light Sala
2. แสดงสถานะ Relay ที่ได้รับการยืนยันจาก ESP8266 ไม่ใช่ถือว่าสำเร็จเพียงเพราะ publish คำสั่งแล้ว
3. แสดง Online/Offline และ Device Status ของ ESP8266
4. แสดงข้อมูลอุณหภูมิและความชื้นจาก DHT11
5. สลับโหมด MANUAL/AUTO
6. ตั้งค่าและแสดง Pump Schedule
7. แสดงเวลา ระบบ และ Error ล่าสุด
8. จัดการข้อมูลถาวรของฟาร์ม เช่น Finance, Crop, History และ Settings ผ่าน Firebase
9. คงฟังก์ชัน Finance เดิม ได้แก่ รายรับ รายจ่าย ยอดคงเหลือ รายการย้อนหลัง และคำแนะนำทางการเงิน
10. ออกแบบ UI ให้ใช้งานได้ดีบนมือถือและเดสก์ท็อป พร้อมสถานะการเชื่อมต่อที่เข้าใจง่าย

---

## สถาปัตยกรรมที่ต้องยึดถือ

```text
ESP8266
   ↓ MQTT over TLS
MQTT Broker
   ↓
Dashboard

Dashboard ── Firebase ── Persistent Data
```

- **MQTT** ใช้สำหรับข้อมูล Real-time และคำสั่งควบคุม
- **Firebase** ใช้สำหรับข้อมูลถาวร เช่น Farm, Crop, Finance, Transaction History และ Settings
- ห้ามใช้ Firebase แทน MQTT สำหรับคำสั่ง Relay แบบ Real-time
- แยกโค้ดเป็นชั้นอย่างชัดเจนอย่างน้อย `control.js`, `mqtt.js`, `firebase-service.js` หรือโครงสร้างเทียบเท่า

Golden flow ของคำสั่ง:

```text
Dashboard → control.js → mqtt.js → MQTT → ESP8266 → relay_controller → GPIO
```

Golden flow ของสถานะ:

```text
GPIO → ESP8266 → mqtt_handler → MQTT → mqtt.js → Dashboard
```

---

## MQTT Contract V1.0 — ห้ามเปลี่ยนโดยพลการ

### การเชื่อมต่อ

- Protocol: MQTT over TLS
- Port: `8883`
- QoS โดยทั่วไป: `1`
- Client ID ต้องไม่ซ้ำกัน เช่น `smartfarm-esp8266-01`
- ทุก Topic ต้องอยู่ภายใต้ namespace `smartfarm/`
- ห้าม hardcode MQTT password, Wi-Fi password, Telegram token หรือ Firebase secret ใน source code, HTML, JavaScript หรือ MQTT payload
- ค่า broker URL, username, password, device ID และ Firebase configuration ต้องรับจาก environment/config ที่ปลอดภัย และมีไฟล์ตัวอย่างที่ไม่ใส่ secret จริง

### Topic และ Payload

| Direction | Topic | Payload | QoS | Retain |
|---|---|---|---:|---:|
| Dashboard → ESP | `smartfarm/relay/pump/set` | `ON` / `OFF` | 1 | false |
| ESP → Dashboard | `smartfarm/relay/pump/status` | `ON` / `OFF` | 1 | true |
| Dashboard → ESP | `smartfarm/relay/zone1/set` | `ON` / `OFF` | 1 | false |
| ESP → Dashboard | `smartfarm/relay/zone1/status` | `ON` / `OFF` | 1 | true |
| Dashboard → ESP | `smartfarm/relay/lighthome/set` | `ON` / `OFF` | 1 | false |
| ESP → Dashboard | `smartfarm/relay/lighthome/status` | `ON` / `OFF` | 1 | true |
| Dashboard → ESP | `smartfarm/relay/lightsala/set` | `ON` / `OFF` | 1 | false |
| ESP → Dashboard | `smartfarm/relay/lightsala/status` | `ON` / `OFF` | 1 | true |
| ESP → Dashboard | `smartfarm/mode/set` | `MANUAL` / `AUTO` | 1 | false |
| ESP → Dashboard | `smartfarm/mode/status` | `MANUAL` / `AUTO` | 1 | true |
| Dashboard → ESP | `smartfarm/schedule/pump/set` | JSON schedule | 1 | false |
| ESP → Dashboard | `smartfarm/schedule/pump/status` | JSON schedule | 1 | true |
| ESP → Dashboard | `smartfarm/status/online` | `true` / `false` | 1 | true |
| ESP → Dashboard | `smartfarm/status/device` | JSON device status | 1 | true |
| ESP → Dashboard | `smartfarm/sensor/dht11` | JSON sensor data | 0 | false |
| ESP → Dashboard | `smartfarm/time` | JSON time data | 0 or 1 | false |
| ESP → Dashboard | `smartfarm/system/error` | JSON error | 1 | false |

Relay command payload ต้องเป็นตัวพิมพ์ใหญ่ `ON` หรือ `OFF` เท่านั้น ห้ามส่ง `1`, `0`, `true`, `false`, `START` หรือข้อความอื่น

### JSON Schema ที่ต้องรองรับ

Sensor DHT11:

```json
{
  "temperature": 31.5,
  "humidity": 72.0,
  "unitTemperature": "C",
  "unitHumidity": "%",
  "timestamp": "2026-09-10T12:30:00+07:00"
}
```

> หากอุปกรณ์เดิมส่งชื่อ `unit_temperature` และ `unit_humidity` ให้ทำ compatibility mapping ที่ชั้น adapter ได้ แต่ข้อมูลภายใน Dashboard ต้องใช้ camelCase ให้เป็นมาตรฐานเดียวกัน

Device status:

```json
{
  "deviceId": "esp8266-01",
  "firmware": "1.0.0",
  "wifi": true,
  "mqtt": true,
  "uptime": 123456,
  "rssi": -61
}
```

Pump schedule:

```json
{
  "enabled": true,
  "on": "06:00",
  "off": "07:00"
}
```

Time:

```json
{
  "date": "2026-09-10",
  "time": "12:30:00",
  "timezone": "Asia/Bangkok",
  "utcOffset": 7
}
```

Error:

```json
{
  "code": "DHT_READ_FAILED",
  "message": "Unable to read DHT11",
  "timestamp": "2026-09-10T12:30:00+07:00"
}
```

ใช้ timestamp แบบ ISO 8601 และ timezone `Asia/Bangkok` / UTC+7 สำหรับข้อมูลที่มีเวลา

---

## กฎการทำงานของ Dashboard

1. เมื่อผู้ใช้กดปุ่ม Relay ให้ validate ค่าและ publish ไปยัง topic `/set` เท่านั้น
2. ระหว่างรอผลตอบกลับ ให้แสดงสถานะ `กำลังส่งคำสั่ง` หรือ `รอยืนยัน`
3. เปลี่ยนสถานะใน UI เป็นสำเร็จต่อเมื่อได้รับ message จาก topic `/status` ที่ตรงกับคำสั่งเท่านั้น
4. หาก MQTT หลุด ห้ามให้ผู้ใช้เข้าใจว่าสั่งงานสำเร็จ ต้อง disable control หรือแสดงคำเตือนชัดเจน
5. แยกสถานะ `desired state` กับ `reported state` หากคำสั่งยังไม่ได้รับการยืนยัน
6. เมื่อ reconnect ให้ subscribe topics ทั้งหมดอีกครั้ง และใช้ retained status ที่ broker ส่งกลับมาเพื่อ hydrate UI
7. Parse JSON อย่างปลอดภัย ตรวจ schema, type และช่วงค่าก่อนนำไปใช้
8. ค่า `temperature` และ `humidity` ต้องเป็น number ไม่ใช่ string
9. คำสั่ง Mode อนุญาตเฉพาะ `MANUAL` และ `AUTO`
10. Schedule ต้องตรวจสอบเวลา `HH:mm`, การเปิด/ปิดใช้งาน และกรณีเวลาสิ้นสุดก่อนเวลาเริ่มต้นตามกติกาที่กำหนดใน UI
11. แสดง error จาก `smartfarm/system/error` พร้อม code, message และ timestamp โดยไม่แสดง secret
12. รองรับ loading, empty state, error state และ offline state อย่างชัดเจน

---

## โครงสร้าง UI ที่ต้องการ

จัด Dashboard เป็นส่วนต่อไปนี้:

- **ภาพรวมระบบ:** MQTT connection, ESP online/offline, firmware, RSSI, uptime และเวลาล่าสุด
- **ควบคุมอุปกรณ์:** การ์ด Pump, Zone 1, Light Home, Light Sala พร้อม toggle/control และ reported status
- **โหมดการทำงาน:** MANUAL/AUTO พร้อมสถานะปัจจุบัน
- **Sensor:** temperature, humidity, timestamp และสถานะข้อมูลล่าสุด
- **Pump Schedule:** enabled, เวลาเปิด, เวลาปิด, ปุ่มบันทึก และสถานะที่ ESP ยืนยัน
- **Finance:** รายรับ รายจ่าย คงเหลือ ฟอร์มเพิ่มรายการ รายการย้อนหลัง และข้อความวิเคราะห์
- **ประวัติ/ข้อผิดพลาด:** แสดง error ที่เกิดขึ้นล่าสุดและข้อมูลเวลาที่เกี่ยวข้อง

UI ต้องใช้ภาษาไทยเป็นหลัก มี label ที่สื่อความหมาย และไม่ใช้ emoji เป็นตัวแทนสถานะเพียงอย่างเดียว ควรใช้สีและข้อความร่วมกันเพื่อรองรับผู้ใช้ที่มองสีแตกต่างกัน

---

## Firebase และข้อมูลถาวร

- เก็บ Finance, Crop, Farm Account, Transaction History และ Settings ใน Firebase
- คง database URL เดิมของโปรเจกต์ไว้ผ่าน config ที่เหมาะสม แต่ห้ามฝัง credential ลับ
- ตรวจสอบ input ก่อนเขียนข้อมูล เช่น amount ต้องเป็นตัวเลขมากกว่าหรือเท่ากับศูนย์ และ note ต้องจำกัดความยาว
- ใช้ listener แบบ realtime เฉพาะข้อมูลที่จำเป็น และยกเลิก listener เมื่อ component/page ถูกทำลายถ้าสถาปัตยกรรมรองรับ
- จัดการ Firebase error และสิทธิ์การเข้าถึงโดยไม่ทำให้หน้าเว็บล่ม
- ห้ามบันทึก MQTT transient status เป็นข้อมูลถาวรโดยอัตโนมัติ เว้นแต่เป็น History ที่ผู้ใช้หรือระบบกำหนดชัดเจน

---

## คุณภาพโค้ดและความปลอดภัย

- ไม่ใส่ secret จริงใน repository, log, error message หรือหน้าเว็บ
- ห้ามใช้ `innerHTML` กับข้อมูลจากผู้ใช้หรือ MQTT โดยไม่ escape/sanitize ให้ปลอดภัย
- ใช้ event listener และฟังก์ชันที่แยกความรับผิดชอบชัดเจน แทน inline handler เมื่อทำได้
- ตรวจสอบ reconnect, duplicate message, malformed JSON และ stale data
- เพิ่ม timeout หรือ indicator สำหรับคำสั่งที่ไม่มี status ตอบกลับ
- เขียน comment เฉพาะจุดที่อธิบายเหตุผลสำคัญ ไม่เขียน comment ซ้ำกับโค้ด
- หากต้องเปลี่ยน contract ให้เพิ่ม version และ migration plan ก่อนเสมอ ห้ามเปลี่ยน topic, payload, field name, QoS, retain behavior หรือ command format โดยไม่มีเหตุผลและเอกสารรองรับ

---

## งานที่ต้องทำตามลำดับ

1. สำรวจ repository และสรุปข้อจำกัดของโค้ดเดิม
2. ออกแบบ module boundary สำหรับ MQTT, Firebase, state และ UI
3. ปรับปรุง Dashboard ให้รองรับส่วนระบบ Smart Farm โดยไม่ทำลาย Finance เดิม
4. เพิ่ม MQTT adapter และ topic constants ตาม Contract V1.0
5. เพิ่ม validation, connection state, acknowledgement และ error handling
6. เพิ่ม responsive UI และ accessibility ขั้นพื้นฐาน
7. เพิ่มไฟล์ `.env.example` หรือ config example ที่ไม่มี secret จริง หากจำเป็น
8. เพิ่มเอกสารการติดตั้ง การตั้งค่า MQTT/Firebase และวิธีทดสอบ
9. ตรวจสอบโค้ดด้วย lint/test หรือการตรวจสอบเทียบเท่าที่เหมาะกับ stack
10. ทดสอบ flow หลักทั้งกรณีสำเร็จและล้มเหลว

---

## เกณฑ์ตรวจรับ (Acceptance Criteria)

- [ ] ทุก topic ที่ใช้ขึ้นต้นด้วย `smartfarm/` และตรงกับ Topic Map
- [ ] Relay ส่งคำสั่งไป `/set` และเปลี่ยน UI จาก `/status` เท่านั้น
- [ ] Relay status ใช้ retained message และ UI รองรับสถานะที่ได้รับหลัง reconnect
- [ ] MQTT disconnect แสดงสถานะชัดเจนและไม่หลอกผู้ใช้ว่าคำสั่งสำเร็จ
- [ ] รองรับ Pump, Zone 1, Light Home และ Light Sala ครบ
- [ ] รองรับ MANUAL/AUTO และ Pump Schedule ครบ
- [ ] แสดง Online/Offline, Device Status, DHT11, Time และ Error
- [ ] JSON ใช้ field naming แบบ camelCase ภายในระบบ และ validate type
- [ ] timestamp ใช้ ISO 8601 และ Asia/Bangkok/UTC+7
- [ ] Finance เดิมยังเพิ่มรายการ คำนวณยอด และแสดงรายการได้
- [ ] Firebase ใช้กับข้อมูลถาวรเท่านั้น ไม่ใช้แทนคำสั่ง MQTT
- [ ] ไม่มี secret หรือ password ใดถูก commit
- [ ] มีเอกสาร setup และวิธีทดสอบ
- [ ] ผ่านการทดสอบกรณี MQTT offline, malformed JSON, invalid relay command, retained status และ Firebase error

---

## รูปแบบผลลัพธ์ที่ต้องส่งมอบ

เมื่อทำงานเสร็จ ให้รายงานเป็นภาษาไทยโดยสรุป:

1. ไฟล์ที่สร้างหรือแก้ไข
2. ความสามารถที่เพิ่มขึ้น
3. การรักษาความเข้ากันได้กับ MQTT Contract V1.0
4. วิธีตั้งค่า environment/config โดยไม่เปิดเผย secret
5. วิธีรันและวิธีทดสอบ
6. ข้อจำกัดหรือรายการที่ยังต้องเชื่อมต่อกับอุปกรณ์จริง

ห้ามอ้างว่าทดสอบกับ ESP8266 หรือ MQTT Broker จริงแล้ว หากยังไม่ได้เชื่อมต่อจริง ให้ระบุว่าเป็นการทดสอบด้วย mock/stub หรือ static validation ตามความเป็นจริง

**เริ่มจากการอ่าน repository ปัจจุบันก่อนลงมือแก้ไข และดำเนินการทีละขั้นโดยตรวจสอบผลหลังแต่ละขั้นตอน**

---

## แหล่งอ้างอิงภายใน repository

- `SMART_FARM_IMPLEMENTATION_PROMPT.md` — พรอมต์ฉบับนี้
- `SMART FARM MQTT CONTRACT V1.0` — สัญญา MQTT ต้นทางจากผู้ใช้
- `index.html` — Dashboard และ Finance เดิมที่ต้องรักษาความสามารถไว้
