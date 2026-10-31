package expo.modules.lighthouseble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

// Must match the iOS module and src/protocol.ts.
private val SERVICE_UUID: ParcelUuid =
  ParcelUuid(UUID.fromString("6E4C0001-8F4A-4B5B-9D2E-5A1C1E7A0B01"))

// iOS peers put "LH" + role + id in their local name.
private const val LOCAL_NAME_PREFIX = "LH"

class LighthouseBleModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  private var advertiseCallback: AdvertiseCallback? = null
  private var scanCallback: ScanCallback? = null
  private var selfId: String = ""

  // Peers whose name arrived in an earlier packet: device address -> (role, id).
  private val knownPeers = mutableMapOf<String, Pair<String, String>>()

  override fun definition() = ModuleDefinition {
    Name("LighthouseBle")

    Events("onPeer", "onState")

    Function("start") { id: String, role: String ->
      stopAll()
      selfId = id
      startAdvertising(role + id)
      startScanning()
    }

    Function("stop") {
      stopAll()
    }

    OnDestroy {
      stopAll()
    }
  }

  private val bluetoothManager: BluetoothManager?
    get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager

  // Runtime permissions are requested from JavaScript before start() is called.
  @SuppressLint("MissingPermission")
  private fun startAdvertising(payload: String) {
    val adapter = bluetoothManager?.adapter
    if (adapter == null || !adapter.isEnabled) {
      sendState("poweredOff", "advertiser")
      return
    }
    val advertiser = adapter.bluetoothLeAdvertiser
    if (advertiser == null) {
      sendState("unsupported", "advertiser")
      return
    }

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .build()
    // The 128-bit UUID fills most of the 31-byte packet, so role + id go in the scan response.
    val data = AdvertiseData.Builder()
      .addServiceUuid(SERVICE_UUID)
      .setIncludeDeviceName(false)
      .build()
    val scanResponse = AdvertiseData.Builder()
      .addServiceData(SERVICE_UUID, payload.toByteArray(Charsets.US_ASCII))
      .setIncludeDeviceName(false)
      .build()

    val callback = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
        sendState("advertising", null)
      }

      override fun onStartFailure(errorCode: Int) {
        sendState("error", "advertising failed: code $errorCode")
      }
    }
    advertiseCallback = callback
    try {
      advertiser.startAdvertising(settings, data, scanResponse, callback)
    } catch (e: SecurityException) {
      sendState("unauthorized", "advertiser")
    }
  }

  @SuppressLint("MissingPermission")
  private fun startScanning() {
    val adapter = bluetoothManager?.adapter
    val scanner = adapter?.bluetoothLeScanner
    if (adapter == null || !adapter.isEnabled || scanner == null) {
      sendState("poweredOff", "scanner")
      return
    }

    val filters = listOf(ScanFilter.Builder().setServiceUuid(SERVICE_UUID).build())
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
      .build()

    val callback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        handleResult(result)
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        results.forEach { handleResult(it) }
      }

      override fun onScanFailed(errorCode: Int) {
        sendState("error", "scan failed: code $errorCode")
      }
    }
    scanCallback = callback
    try {
      scanner.startScan(filters, settings, callback)
      sendState("scanning", null)
    } catch (e: SecurityException) {
      sendState("unauthorized", "scanner")
    }
  }

  private fun handleResult(result: ScanResult) {
    val address = result.device.address
    parse(result)?.let { knownPeers[address] = it }
    val (role, id) = knownPeers[address] ?: return
    if (id == selfId) return

    sendEvent(
      "onPeer",
      mapOf(
        "id" to id,
        "role" to role,
        "rssi" to result.rssi,
        "timestamp" to System.currentTimeMillis().toDouble()
      )
    )
  }

  /** Reads role + id from an Android peer's service data or an iOS peer's local name. */
  private fun parse(result: ScanResult): Pair<String, String>? {
    val record = result.scanRecord ?: return null
    val payload = record.getServiceData(SERVICE_UUID)?.toString(Charsets.US_ASCII)
      ?: record.deviceName?.takeIf { it.startsWith(LOCAL_NAME_PREFIX) }?.removePrefix(LOCAL_NAME_PREFIX)
      ?: return null
    if (payload.length < 2) return null
    return payload.substring(0, 1) to payload.substring(1)
  }

  @SuppressLint("MissingPermission")
  private fun stopAll() {
    val adapter = bluetoothManager?.adapter
    try {
      advertiseCallback?.let { adapter?.bluetoothLeAdvertiser?.stopAdvertising(it) }
      scanCallback?.let { adapter?.bluetoothLeScanner?.stopScan(it) }
    } catch (e: SecurityException) {
      // Permission was revoked while running; nothing left to stop.
    }
    advertiseCallback = null
    scanCallback = null
    knownPeers.clear()
  }

  private fun sendState(state: String, message: String?) {
    sendEvent("onState", mapOf("state" to state, "message" to message))
  }
}
