import CoreBluetooth
import ExpoModulesCore

// Must match SERVICE_UUID in the Android module and src/protocol.ts.
private let serviceUUID = CBUUID(string: "6E4C0001-8F4A-4B5B-9D2E-5A1C1E7A0B01")
// iOS can only advertise a service UUID and a local name, so the payload (role, group, id and
// closeness level; see src/protocol.ts) travels in the local name: "LH" + payload.
private let localNamePrefix = "LH"

public class LighthouseBleModule: Module {
  private var bluetooth: BluetoothController?

  public func definition() -> ModuleDefinition {
    Name("LighthouseBle")

    Events("onPeer", "onState")

    Function("start") { (payload: String) in
      self.stop()
      let controller = BluetoothController(payload: payload)
      controller.onPeer = { [weak self] peer in self?.sendEvent("onPeer", peer) }
      controller.onState = { [weak self] state, message in
        self?.sendEvent("onState", ["state": state, "message": message])
      }
      self.bluetooth = controller
      controller.start()
    }

    Function("setPayload") { (payload: String) in
      self.bluetooth?.setPayload(payload)
    }

    Function("stop") {
      self.stop()
    }

    OnDestroy {
      self.stop()
    }
  }

  private func stop() {
    bluetooth?.stop()
    bluetooth = nil
  }
}

private final class BluetoothController: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
  private(set) var payload: String
  var onPeer: (([String: Any?]) -> Void)?
  var onState: ((String, String?) -> Void)?

  private var central: CBCentralManager?
  private var peripheral: CBPeripheralManager?
  // Latest payload seen from each peer (the name is not in every packet): iOS identifier -> payload.
  private var knownPeers: [UUID: String] = [:]

  init(payload: String) {
    self.payload = payload
  }

  /// Restarts advertising with a new payload; the seeker does this when its closeness level changes.
  func setPayload(_ newPayload: String) {
    guard newPayload != payload else { return }
    payload = newPayload
    guard let peripheral, peripheral.state == .poweredOn else { return }
    peripheral.stopAdvertising()
    advertise(peripheral)
  }

  func start() {
    // Both managers report their state asynchronously; work starts once each is powered on.
    central = CBCentralManager(delegate: self, queue: nil)
    peripheral = CBPeripheralManager(delegate: self, queue: nil)
  }

  func stop() {
    central?.stopScan()
    peripheral?.stopAdvertising()
    central?.delegate = nil
    peripheral?.delegate = nil
    central = nil
    peripheral = nil
  }

  // MARK: - Scanning

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard central.state == .poweredOn else {
      onState?(Self.describe(central.state), "scanner")
      return
    }
    central.scanForPeripherals(
      withServices: [serviceUUID],
      options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
    )
    onState?("scanning", nil)
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    let rssi = RSSI.intValue
    // 127 means the RSSI was unavailable.
    guard rssi != 127 else { return }

    if let parsed = Self.parse(advertisementData) {
      knownPeers[peripheral.identifier] = parsed
    }
    guard let peerPayload = knownPeers[peripheral.identifier] else { return }

    // JavaScript decodes the payload, checks the group and ignores this phone's own id.
    onPeer?([
      "payload": peerPayload,
      "rssi": rssi,
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
  }

  /// Reads the payload from an iOS peer's local name or an Android peer's service data.
  private static func parse(_ data: [String: Any]) -> String? {
    if let name = data[CBAdvertisementDataLocalNameKey] as? String,
       name.hasPrefix(localNamePrefix) {
      return String(name.dropFirst(localNamePrefix.count))
    }
    if let serviceData = data[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
       let payload = serviceData[serviceUUID],
       let text = String(data: payload, encoding: .ascii) {
      return text
    }
    return nil
  }

  // MARK: - Advertising

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard peripheral.state == .poweredOn else {
      onState?(Self.describe(peripheral.state), "advertiser")
      return
    }
    advertise(peripheral)
  }

  private func advertise(_ peripheral: CBPeripheralManager) {
    peripheral.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
      CBAdvertisementDataLocalNameKey: localNamePrefix + payload
    ])
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error {
      onState?("error", "advertising failed: \(error.localizedDescription)")
    } else {
      onState?("advertising", nil)
    }
  }

  private static func describe(_ state: CBManagerState) -> String {
    switch state {
    case .poweredOff: return "poweredOff"
    case .unauthorized: return "unauthorized"
    case .unsupported: return "unsupported"
    case .resetting: return "resetting"
    default: return "unknown"
    }
  }
}
