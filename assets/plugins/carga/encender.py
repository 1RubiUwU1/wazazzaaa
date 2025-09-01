import json
import asyncio  
from tapo import ApiClient

with open('config.json', 'r') as file:
    config = json.load(file)

EMAIL = config['sys']['GML']
PASSWORD = config['sys']['PASS']
DEVICE_IP = config['ports']['bateria']

async def on():
    try:
        client = ApiClient(EMAIL, PASSWORD)
        device = await client.p100(DEVICE_IP)
        await device.on()
        print("Enchufe encendido.")
    except Exception as e:
        print(f"Error:", {e})

async def off():
    try:
        client = ApiClient(EMAIL, PASSWORD)
        device = await client.p100(DEVICE_IP)
        await device.off()
        print("Enchufe apagado.")
    except Exception as e:
        print(f"Error:", {e})

if __name__ == "__main__":
    asyncio.run(on())
