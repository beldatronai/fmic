import CoreBluetooth
import ExpoModulesCore

// Must match SERVICE_UUID in the Android module and src/protocol.ts.
private let serviceUUID = CBUUID(string: "6E4C0001-8F4A-4B5B-9D2E-5A1C1E7A0B01")
// iOS can only advertise a service UUID and a local name, so the peer's role and id
// travel in the local name: "LH" + role + id, e.g. "LHLAB12".
private let localNamePrefix = "LH"

public class LighthouseBleModule: Module {
  private var bluetooth: BluetoothController?

  public func definition() -> ModuleDefinition {
    Name("LighthouseBle")

    Events("onPeer", "onState")

    Function("start") { (selfId: String, role: String) in
      self.stop()
      let controller = BluetoothController(selfId: selfId, role: role)
      controller.onPeer = { [weak self] peer in self?.sendEvent("onPeer", peer) }
      controller.onState = { [weak self] state, message in
        self?.sendEvent("onState", ["state": state, "message": message])
      }
      self.bluetooth = controller
      controller.start()
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
  let selfId: String
  let role: String
  var onPeer: (([String: Any?]) -> Void)?
  var onState: ((String, String?) -> Void)?

  private var central: CBCentralManager?
  private var peripheral: CBPeripheralManager?
  // Peers whose name arrived in an earlier packet: iOS identifier -> "role:id".
  private var knownPeers: [UUID: (role: String, id: String)] = [:]

  init(selfId: String, role: String) {
    self.selfId = selfId
    self.role = role
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
    guard let peer = knownPeers[peripheral.identifier] else { return }
    if peer.id == selfId { return }

    onPeer?([
      "id": peer.id,
      "role": peer.role,
      "rssi": rssi,
      "timestamp": Date().timeIntervalSince1970 * 1000
    ])
  }

  /// Reads "role + id" from an iOS peer's local name or an Android peer's service data.
  private static func parse(_ data: [String: Any]) -> (role: String, id: String)? {
    if let name = data[CBAdvertisementDataLocalNameKey] as? String,
       name.hasPrefix(localNamePrefix) {
      return split(String(name.dropFirst(localNamePrefix.count)))
    }
    if let serviceData = data[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
       let payload = serviceData[serviceUUID],
       let text = String(data: payload, encoding: .ascii) {
      return split(text)
    }
    return nil
  }

  private static func split(_ payload: String) -> (role: String, id: String)? {
    guard payload.count >= 2 else { return nil }
    return (String(payload.prefix(1)), String(payload.dropFirst()))
  }

  // MARK: - Advertising

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard peripheral.state == .poweredOn else {
      onState?(Self.describe(peripheral.state), "advertiser")
      return
    }
    peripheral.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
      CBAdvertisementDataLocalNameKey: localNamePrefix + role + selfId
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
