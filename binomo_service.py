import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from binomoapi.stable_api import Binomo
import threading
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Binomo credentials
AUTHTOKEN = os.environ.get('BINOMO_AUTHTOKEN', '2ba71577-82f7-4751-8902-4de7f0c94831')
DEVICE_ID = os.environ.get('BINOMO_DEVICE_ID', '636d5616769d02c84c488e3353f28789')
DEVICE_TYPE = os.environ.get('BINOMO_DEVICE_TYPE', 'web')

# Global Binomo instance
binomo_client = None
is_connected = False
current_balance = {"demo": 0, "real": 0}
active_assets = []
candle_data = {}

def initialize_binomo():
    global binomo_client, is_connected, current_balance, active_assets
    try:
        binomo_client = Binomo(set_ssid=AUTHTOKEN, device_id=DEVICE_ID)
        check_connect, message = binomo_client.connect()
        
        if check_connect:
            is_connected = True
            print(f"✅ Binomo connected successfully: {message}")
            
            # Get initial balance
            try:
                balance_info = binomo_client.get_balance()
                if balance_info:
                    current_balance["demo"] = balance_info.get("demo", 0)
                    current_balance["real"] = balance_info.get("real", 0)
            except:
                pass
            
            # Get available assets
            try:
                assets_data = binomo_client.get_all_open_time()
                if assets_data:
                    active_assets = [
                        {
                            "id": asset.get("id"),
                            "name": asset.get("name"),
                            "symbol": asset.get("symbol", asset.get("name")),
                            "isActive": asset.get("is_open", True)
                        }
                        for asset in assets_data
                        if asset.get("is_open", True)
                    ]
            except:
                pass
            
        else:
            print(f"❌ Failed to connect to Binomo: {message}")
            is_connected = False
    except Exception as e:
        print(f"❌ Error initializing Binomo: {str(e)}")
        is_connected = False

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "connected": is_connected,
        "service": "binomo-api"
    })

@app.route('/balance', methods=['GET'])
def get_balance():
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        balance_type = request.args.get('type', 'demo')
        balance = binomo_client.get_balance()
        return jsonify({
            "demo": balance.get("demo", 0),
            "real": balance.get("real", 0),
            "current": balance.get(balance_type, 0)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/assets', methods=['GET'])
def get_assets():
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        assets = binomo_client.get_all_open_time()
        formatted_assets = []
        
        for asset in assets:
            if asset.get("is_open", False):
                formatted_assets.append({
                    "id": asset.get("id"),
                    "name": asset.get("name"),
                    "symbol": asset.get("symbol", asset.get("name")),
                    "category": asset.get("type", "forex"),
                    "isActive": True,
                    "payoutRate": asset.get("payout", 82)
                })
        
        return jsonify(formatted_assets)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/candles/<asset_id>', methods=['GET'])
def get_candles(asset_id):
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        size = int(request.args.get('size', 60))  # Default 1 minute
        count = int(request.args.get('count', 100))
        
        candles = binomo_client.get_candles(asset_id, size, count)
        
        if candles:
            formatted_candles = [
                {
                    "timestamp": candle.get("at", 0),
                    "open": float(candle.get("open", 0)),
                    "high": float(candle.get("high", 0)),
                    "low": float(candle.get("low", 0)),
                    "close": float(candle.get("close", 0)),
                    "volume": float(candle.get("volume", 0))
                }
                for candle in candles
            ]
            return jsonify(formatted_candles)
        else:
            return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/trade', methods=['POST'])
def execute_trade():
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        data = request.json
        asset_id = data.get('asset_id')
        amount = float(data.get('amount', 1))
        direction = data.get('direction', 'call').lower()  # 'call' or 'put'
        duration = int(data.get('duration', 1))  # in minutes
        
        # Execute trade
        check, result = binomo_client.buy(asset_id, amount, direction, duration)
        
        if check:
            return jsonify({
                "success": True,
                "trade_id": result.get("uuid"),
                "asset_id": asset_id,
                "amount": amount,
                "direction": direction,
                "duration": duration,
                "result": result
            })
        else:
            return jsonify({
                "success": False,
                "error": "Trade execution failed",
                "details": result
            }), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/trade/check/<trade_id>', methods=['GET'])
def check_trade(trade_id):
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        result = binomo_client.check_win(trade_id)
        return jsonify({
            "trade_id": trade_id,
            "result": result
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/account/switch', methods=['POST'])
def switch_account():
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        data = request.json
        account_type = data.get('type', 'PRACTICE').upper()  # 'PRACTICE' or 'REAL'
        
        binomo_client.change_balance(account_type)
        
        return jsonify({
            "success": True,
            "account_type": account_type
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/price/current/<asset_id>', methods=['GET'])
def get_current_price(asset_id):
    if not is_connected:
        return jsonify({"error": "Not connected to Binomo"}), 503
    
    try:
        # Get the latest candle to get current price
        candles = binomo_client.get_candles(asset_id, 60, 1)
        
        if candles and len(candles) > 0:
            latest = candles[0]
            return jsonify({
                "asset_id": asset_id,
                "price": float(latest.get("close", 0)),
                "timestamp": latest.get("at", 0)
            })
        else:
            return jsonify({"error": "No price data available"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Binomo API Service...")
    print(f"📡 AUTHTOKEN: {AUTHTOKEN[:10]}...")
    print(f"📱 DEVICE_ID: {DEVICE_ID[:10]}...")
    
    # Initialize Binomo connection
    initialize_binomo()
    
    # Start Flask server
    port = int(os.environ.get('BINOMO_SERVICE_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
