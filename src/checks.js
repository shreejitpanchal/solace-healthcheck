// Solace Ops Readiness Checklist definition.
//
// Each entry is one row of the checklist. Rows whose ref has one segment ("1") are
// groups, two segments ("1.1") are categories and three segments ("1.1.1") are checks.
//
// `commands` lists the CLI sections that provide evidence for the check. Each entry may
// contain alternatives separated by "|" (first match wins), e.g. "show system detail|show system".
// Sections come from cli-diagnostics.txt (gather-diagnostics) or from a supplemental CLI
// transcript. Checks without commands are either answered from the current-config export
// (see config-parser.js) or are manual.
//
// The verdict logic for each ref lives in analyzers.js. Add a new check by appending a row
// here and, if it can be evaluated automatically, an analyzer keyed by its ref.

export const CHECKS = [
  {
    ref: "1",
    check: "Group: System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.1",
    check: "Category: Basic System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.1.1",
    check: "Management Link",
    description: "Management interface should be detected on the Solace broker",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show interface intf0\"",
    expected: "Interface: intf0\n  Enabled: yes\n  Operational State: Up\n  Link detected: yes",
    commands: [
      "show interface intf0"
    ]
  },
  {
    ref: "1.1.2",
    check: "ADB Links",
    description: "For HA pairs only, the ADB links should be established between active and backup nodes",
    requirement: "As stated",
    source: "NA",
    expected: "NA",
    commands: [
      "show redundancy detail"
    ]
  },
  {
    ref: "1.1.3",
    check: "System POST",
    description: "The System Power On Self Test (POST) should be successfully passed",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show system post\"",
    expected: "Overall Power-On Self Test (POST) Status: PASSED",
    commands: [
      "show system post"
    ]
  },
  {
    ref: "1.1.4",
    check: "IP address assignment - Management Interface",
    description: "A single IP address should be assigned to the management interface and the default route must be configured",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show ip vrf management\"",
    expected: "IP Address and default gateway are assigned to interface: intf0\n",
    commands: [
      "show ip vrf management"
    ]
  },
  {
    ref: "1.1.5",
    check: "SolOS firmware Version",
    description: "Solace brokers have SolOS version as decided in design",
    requirement: "Version: <solOS version>",
    source: "CLI/SEMP: \n\"show version\"",
    expected: "Version <solOS version>",
    commands: [
      "show version"
    ]
  },
  {
    ref: "1.1.6",
    check: "Management Service Configuration",
    description: "SEMP services are enabled and configured with ports according to configuration plan",
    requirement: "SEMP (Secure) only",
    source: "CLI/SEMP:\n \"show service\"",
    expected: "SEMP Port 8080 (PlainText): Up/Down\nSEMP Port 1943 (Secure): Up",
    commands: [
      "show service"
    ]
  },
  {
    ref: "1.1.7",
    check: "Messaging Service Configuration",
    description: "Only the required messaging services are enabled as per design specification",
    requirement: "SMF (Secure)",
    source: "CLI/SEMP:\n \"show service\"\n\n\"show message-vpn <vpn-name> service\"",
    expected: "Broker Enabled Services:\n- SMF\n\nMessage VPN Enabled Service:\n- SMF (Secure)",
    commands: [
      "show service"
    ]
  },
  {
    ref: "1.1.8",
    check: "Connection Scaling Tier",
    description: "Event brokers should be configured with the max-connection scaling tier as per design specification (Software broker)",
    requirement: "Software broker: 1000",
    source: "CLI/SEMP:\n \"show system\"",
    expected: "Max Connections: 1000",
    commands: [
      "show system detail"
    ]
  },
  {
    ref: "1.1.9",
    check: "Hostname and router name",
    description: "A unique hostname and corresponding router name should be assigned to each broker. The router name should mirror the hostname",
    requirement: "",
    source: "CLI/SEMP:\n\"show hostname\"\n\"show router-name\"",
    expected: "Verify CLI output for hostname and router-name",
    commands: [
      "show hostname",
      "show router-name"
    ]
  },
  {
    ref: "1.1.10",
    check: "DNS Server Configuration",
    description: "Redundant DNS servers are configured for each Solace broker",
    requirement: "",
    source: "OS (Software):\ncat /etc/resolv.conf",
    expected: "nameserver <dns ip>",
    commands: [
      "show debug dns"
    ]
  },
  {
    ref: "1.1.11",
    check: "NTP Server Configuration",
    description: "NTP servers must be configured in order to synchronise the Solace broker's clock with an NTP server and the correct timezone should be applied",
    requirement: "",
    source: "OS (Software):\nntpstat\ntimedatectl status",
    expected: "ntpstat output: synchronized\n\nTime zone: <your-timezone>\n\nSystem clock synchronized: yes or \nNTP synchronized: yes\n\nNTP service: active or \nNTP enabled: yes\n",
    commands: []
  },
  {
    ref: "1.2",
    check: "Message Spool Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.2.1",
    check: "Storage Externalization",
    description: "Solace event brokers' storage should be mounted on external block storage",
    requirement: "Size: xx GB",
    source: "OS (Software):\nVerify volume mapping to container directory: /var/lib/solace",
    expected: "Solace Storage Elements are mounted on external block device",
    commands: [
      "show storage-element * detail"
    ]
  },
  {
    ref: "1.2.2",
    check: "Message Spool Configuration",
    description: "The message-spool must be configured with the max-spool usage as per design specification",
    requirement: "xx_000 MB",
    source: "CLI/SEMP:\n\"show message-spool\"",
    expected: "Maximum Spool Usage: <spool size> MB",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.2.3",
    check: "Message Spool State",
    description: "The message-spool must be enabled. The state of the message-spool depends on the Solace broker deployment:\n> Enabled (Primary) for standalone brokers, and the primary broker in an HA pair\n> Enabled (Backup) for the backup broker in an HA pair",
    requirement: "As stated",
    source: "CLI/SEMP:\n\"show message-spool\"",
    expected: "Primary appliance:\nConfig Status: Enabled (Primary)\nOperational Status: AD-Active\n\nBackup appliance:\nConfig Status: Enabled (Backup)\nOperational Status: AD-Standby",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.2.4",
    check: "Message Spool Defragmentation",
    description: "The message-spool should have auto defragmentation with either scheduled or threshold method.\nWhen auto defragmentation is not configured, the SYSTEM_AD_SPOOL_FILES_HIGH event should be monitored and manual defragmentation should be performed manually.",
    requirement: "Threshold condition: \n50% fragmentation and\n50% spool usage",
    source: "CLI/SEMP:\n\"show message-spool detail\"",
    expected: "Schedule Enabled: Yes/No\n  Days: <days-of-week>\n  Times: <times-of-week>\nThreshold Enabled: Yes\n  Fragmentation: 50% \n  Spool Usage: 50%",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.3",
    check: "Fault-Tolerant Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.3.1",
    check: "Redundancy",
    description: "Solace brokers deployed as an HA pair must have the redundancy service configured and enabled. Matelink should be SSL enabled",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show redundancy detail\"",
    expected: "Configuration Status     : Enabled\nRedundancy Status      : Up\nADB Link To Mate         : Up\nADB Hello To Mate        : Up\n  Mate-Link Connect Via  : \n    Remote Port          : 8741\n    SSL                  : Yes",
    commands: [
      "show redundancy detail",
      "show redundancy group"
    ]
  },
  {
    ref: "1.3.2",
    check: "Config-Sync",
    description: "Solace brokers deployed as an HA pair must have the Config-Sync service enabled in order to synchronise configuration parameters. SSL should be enabled",
    requirement: "As stated",
    source: "CLI/SEMP:\n\"show config-sync\"",
    expected: "Admin Status: Enabled\nOper Status: Up\nSSL Enabled: Yes",
    commands: [
      "show config-sync",
      "show config-sync database detail"
    ]
  },
  {
    ref: "1.4",
    check: "External Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.4.1",
    check: "LDAP Profile Configuration",
    description: "LDAP Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show ldap-profile <profile-name> detail\"",
    expected: "Admin Status: Enabled\nAdmin DN: <LDAP query user>\nSTARTTLS: Yes/No\nSearch:\nBase DN: <base search dn>\nLDAP Server Index #: <ldap-server-fqdn>",
    commands: [
      "show ldap-profile * detail"
    ]
  },
  {
    ref: "1.4.2",
    check: "Oauth Profile Configuration",
    description: "Oauth Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show authentication user-class cli-semp\"\n\n \"show oauth-profile <profile-name> detail\"",
    expected: "Default Oauth Profile: <profile-name>\n\nAdmin Status: Enabled\nActive: Yes\nClient ID: <oauth-id>\nClient Secret Configured: Yes\nUsername Claim: <assignd>\nGroup Claim: <asigned>\nIssuer: <configured>",
    commands: [
      "show authentication access-level detail",
      "show oauth-profile * detail"
    ]
  },
  {
    ref: "1.5",
    check: "Management User Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.5.1",
    check: "Global CLI Users",
    description: "Global CLI and File transfer Users  should be configured as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show username *\"\n\"show username * detail\"",
    expected: "Only authorized internal CLI and filetransfer users are created.",
    commands: [
      "show username * detail"
    ]
  },
  {
    ref: "1.5.2",
    check: "Default Global Access",
    description: "Default Global Access is set to none",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "Access-Level Configuration:\n  Default:\n    Global Acces Level: none",
    commands: [
      "show authentication access-level default|show authentication access-level detail"
    ]
  },
  {
    ref: "1.5.3",
    check: "CLI Authentication type",
    description: "CLI authentication type is configured as per design specification:\nAuth-type:\nInternal\nLDAP\nRadius",
    requirement: "",
    source: "CLI/SEMP:\nshow authentication access-level detail",
    expected: "CLI and SEMP user class:\n  auth-type:  <type>\n  profile-name: <profile-name>",
    commands: [
      "show authentication access-level detail"
    ]
  },
  {
    ref: "1.5.4",
    check: "CLI LDAP Authorization Group",
    description: "LDAP Groups are assigned to one of the following permissions as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level ldap\"\n\n \"show authentication access-level ldap detail\"",
    expected: "Only authorized LDAP groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [
      "show authentication access-level ldap detail|show authentication access-level ldap"
    ]
  },
  {
    ref: "1.5.5",
    check: "CLI Oauth Authorization Group",
    description: "OAuth Groups are assigned to one of the following permissions as per design specification:\nread-only\nmesh-manager\nread-write\nadmin",
    requirement: "",
    source: "CLI/SEMP:\n \"show oauth-profile <oauth-profile-name> access-level\"\n\n \"show oauth-profile <oauth-profile-name> access-level detail\"",
    expected: "Only authorized Oauth groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [
      "show oauth-profile * access-level detail|show oauth-profile * access-level"
    ]
  },
  {
    ref: "1.6",
    check: "Monitoring Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.6.1",
    check: "Syslog Forwarding",
    description: "Local Syslog log files must be forwarded to remote hosts for archival and retention ",
    requirement: "",
    source: "CLI/SEMP:\n\"show syslog\"",
    expected: "Facilities: event system\nHosts: <syslog server ip:port>\nTransport: TCP/UDP",
    commands: [
      "show syslog"
    ]
  },
  {
    ref: "1.6.2",
    check: "Syslog Server",
    description: "Solace Logs are recorded in Syslog Server",
    requirement: "",
    source: "Verify at external Syslog Server",
    expected: "Broker event and system logs are recorded in external syslog server",
    commands: []
  },
  {
    ref: "1.6.3",
    check: "Metrics Monitoring",
    description: "Solace metrics are collected at monitoring server as per design specification",
    requirement: "",
    source: "Verify at external Monitoring Server",
    expected: "Broker metrics are recorded in external monitoring server",
    commands: []
  },
  {
    ref: "1.7",
    check: "Backup Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.7.1",
    check: "Scheduled Backup Configuration",
    description: "A scheduled backup must be configured for all Solace brokers to the local file system with a retention period of XX copies as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show backup\"",
    expected: "Schedule: <day> <time>\nMax Backups: <number of retention>",
    commands: [
      "show backup"
    ]
  },
  {
    ref: "1.7.2",
    check: "Backup Archival",
    description: "The local configuration backups must be transferred to a remote location for retention and archival if required for retention beyond the “max-backups” configuration on the broker scheduled backup.",
    requirement: "",
    source: "External scheduling for collecting backup file from Solace broker",
    expected: "Backup files are copied to external storage",
    commands: []
  },
  {
    ref: "1.8",
    check: "Certificates",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.8.1",
    check: "Server Certificate Configuration",
    description: "A server certificate must be generated and configured for each Solace broker with correct CN and SAN ",
    requirement: "",
    source: "CLI/SEMP: \n\"show ssl server-certificate detail\"",
    expected: "CN: primary-router name\nSAN: primary fqdn, backup fqdn",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "1.8.2",
    check: "Server Certificate Expiry",
    description: "The server certificate configured on the Solace appliance must be valid and not expired",
    requirement: "",
    source: "CLI/SEMP: \n\"show ssl server-certificate detail\" ",
    expected: "Server Certificate is valid",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "1.8.3",
    check: "Domain/Trust Certificate",
    description: "Certificate Authorities must be configured for connection to external secure systems (Remote brokers, LDAP)",
    requirement: "",
    source: "CLI/SEMP: \n\"show domain-certificate-authority ca-name * cert\" ",
    expected: "Certificates are valid",
    commands: [
      "show domain-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "1.8.4",
    check: "Client Certificate",
    description: "Client Certificate Authorities must be configured for accepting client-certificate authentication from client and bridge users",
    requirement: "",
    source: "CLI/SEMP: \n\"show client-certificate-authority ca-name * cert\" ",
    expected: "Certificates are valid",
    commands: [
      "show client-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "1.9",
    check: "DR Replication Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.9.1",
    check: "Replication",
    description: "Replication Mate is configured as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \n\"show replication\"",
    expected: "Replication Mate: v:<router-name>\n    Plain Text:      <ip/hostname>:55555\n    Compressed: <ip/hostname>:55003\n    SSL:               <ip/hostname>:55443\nSSL:\n  Trusted Common Names: <certificate CN>",
    commands: [
      "show replication stats|show replication",
      "show message-vpn * replication"
    ]
  },
  {
    ref: "1.9.2",
    check: "Config-Sync",
    description: "Replication Config-sync between the active and standby site is configured (with SSL enabled.)",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show replication\"",
    expected: "ConfigSync:\n  Bridge:                          \n    Admin State: Enabled\n    State: Up\nSSL: Yes/No",
    commands: [
      "show replication stats|show replication"
    ]
  },
  {
    ref: "1.10",
    check: "Host System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.1",
    check: "Compute Resources",
    description: "Solace broker workload is allocated with sufficient CPU and RAM according to the broker size and other scaling parameters.",
    requirement: "",
    source: "",
    expected: "",
    commands: [
      "show system detail",
      "show memory"
    ]
  },
  {
    ref: "1.10.2",
    check: "Virtual Machine Network",
    description: "Virtual Network Interface is assigned with sufficient bandwidth.",
    requirement: "1Gbps or higher\nVmware: use VMX3",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.3",
    check: "Storage",
    description: "High performance external storage to be assigned for Solace broker.\nAppliance: SAN SSD storage\nSoftware/Cloud: Volume mapping from SSD Block storage\n",
    requirement: "",
    source: "",
    expected: "",
    commands: [
      "show storage-element * detail"
    ]
  },
  {
    ref: "1.10.4",
    check: "Container Runtime Network",
    description: "High performance container runtime network must be used for Solace software broker\n",
    requirement: "Docker/Podman: Use host or bridge network",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.5",
    check: "Additional co-located services",
    description: "Co-located services running on the same host as Solace broker must have additional CPU, memory, and disk resources being allocated. Each service should be reviewed to ensure it does not negatively impact broker's performance.",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.11",
    check: "System Health",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.11.1",
    check: "No System Alarms",
    description: "There should be no system alarms displayed for the Solace appliance - any alarms displayed should be acted upon to remediate the situation",
    requirement: "",
    source: "NA",
    expected: "NA",
    commands: [
      "show debug ad-show-alarms",
      "show system health"
    ]
  },
  {
    ref: "1.11.2",
    check: "No recurring errors in Logs",
    description: "There should be no recurring errors in the System Log indicative of an error condition",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show log system lines 100\"",
    expected: "No recurring error in System Log",
    commands: [
      "show log rest rest-delivery-point errors wide",
      "show log system lines 100"
    ]
  },
  {
    ref: "1.11.3",
    check: "Message Discards",
    description: "Egress and ingress discard counters should not be growing. Transmit congestion, spool egress discards, expired and TTL-exceeded messages indicate slow consumers or misconfigured TTLs.",
    requirement: "No unexplained discards",
    source: "CLI/SEMP:\n\"show stats client detail\"\n\"show message-spool stats\"",
    expected: "Total Ingress Discards: 0\nTotal Egress Discards: 0 (or explained)\nMessages Expired To Discard: 0\nTTL Exceeded To Discard: 0",
    commands: [
      "show stats client detail",
      "show message-spool stats"
    ]
  },
  {
    ref: "2",
    check: "Message-VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.1",
    check: "Basic VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.1.1",
    check: "VPN Name and Status",
    description: "Message VPN name is created as per naming convention and its status is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP from active broker:\n \"show message-vpn <name>\"",
    expected: "Message VPN: default\nLocal Status: Down\n\nMessage VPN: <others>\nLocal Status: Up/Standby/Down",
    commands: [
      "show message-vpn *"
    ]
  },
  {
    ref: "2.1.2",
    check: "VPN Authentication and Authorization",
    description: "Message VPN should be configured with authentication and authorization method as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n \"show message-vpn <name> authorization\"",
    expected: "BASIC:\nBasic Authentication: Enabled\n  Auth Type: internal/ldap\n  Auth Profile: <ldap-profile-name>\n\nCLIENT CERTIFICATE:\nClient Certificate Authentication :  Enabled/Disabled\n\nOAUTH:\nOauth Authentication Enabled: Yes/No\n(oauth) Default Profile Name: <oauth-profile>\n\nAUTHORIZATION TYPE:\nAuthorization Type: Internal/ldap",
    commands: [
      "show message-vpn * detail"
    ]
  },
  {
    ref: "2.1.3",
    check: "VPN Limits",
    description: "VPN Resouces should be set as per connection scaling tier and the properties of message-spool: \n- size\n- connections\n- subscriptions\n- message-spool quota\n- ingress flows\n- egress flows\nare configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show message-spool message-vpn <name>\"",
    expected: "Max Incoming Connections: 1000\n\nMaximum Queues and Topic-Endpoints:1000\nMax Allowed Spool Usage (MB): 60000\nMax Egress Flows: 1000\nMax Ingress Flows: 1000",
    commands: [
      "show message-vpn * detail",
      "show message-spool message-vpn * detail"
    ]
  },
  {
    ref: "2.1.4",
    check: "VPN Messaging Service Configuration",
    description: "Only the required messaging services are enabled",
    requirement: "SMF",
    source: "CLI/SEMP:\n \"show message-vpn <name> service\"",
    expected: "SMF TCP 55443: Up",
    commands: [
      "show message-vpn * service"
    ]
  },
  {
    ref: "2.1.5",
    check: "Client Profiles",
    description: "Client Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "App Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: No\nAllow Shared Subscriptions: No\n\nBridge Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: Yes\nAllow Shared Subscriptions: No",
    commands: [
      "show client-profile * detail"
    ]
  },
  {
    ref: "2.1.6",
    check: "ACL Profiles",
    description: "ACL Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile *\"",
    expected: "Conn: n, exception: [list]\nPub: n, exception: [list]\nSub: n, exception: [list]\nShare: y",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "2.1.7",
    check: "Client Usernames",
    description: "Client Usernames should be created as per design specification and assigned to correct client profile and acl profile\nDefault username should be disabled",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username * detail\"",
    expected: "Username: default\nEnabled: No\n\nUsername: <username>\nMessage VPN: <vpn>\nClient Profile: <client-profile>\nACL Profile: <acl-profile>\nEnabled: yes",
    commands: [
      "show client-username * detail"
    ]
  },
  {
    ref: "2.1.8",
    check: "Queue",
    description: "All queues should be created as per design specification and configured will appropriate permissions (owner, permissions and access-type)",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * detail\"",
    expected: "App Queue:\nName: <queue name>\nMessage VPN: <vpn>\nOwner: <owner name>\nAll Other Permission: <Consume/Read-Only/No Access>\n\nRemote Bridge Queue:\nName: <queue name>\nMessage VPN: <vpn>\nAccess Type: Exclusive\nOwner: <bridge user>\nAll Other Permission: <Consume/Read-Only/No Access>\nMax Bind Count: 1",
    commands: [
      "show queue * detail"
    ]
  },
  {
    ref: "2.1.9",
    check: "Topic to Queue mapping",
    description: "Queues have topic subscriptions as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * subscriptions\"",
    expected: "Queue subscribes only to required topics",
    commands: [
      "show queue * subscriptions"
    ]
  },
  {
    ref: "2.2",
    check: "VPN Bridge Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.2.1",
    check: "VPN Bridge",
    description: "VPN Bridges should be configured between VPNs as per design specification, such as:\nAuthentication scheme\nTransport property\nMax TTL\nSpool queue and window size",
    requirement: "",
    source: "CLI/SEMP: \n\"show bridge * detail\"",
    expected: "Unidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\n\nBidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\nOutbound Oper State: Up",
    commands: [
      "show bridge *",
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.2",
    check: "Remote Queue Subscriptions",
    description: "Bridge remote queue should be configured with subscriptions as per design specification",
    requirement: "",
    source: "Local VPN (destination):\nCLI/SEMP: \n\"show bridge <name> message-vpn <vpn> detail\"\n\nRemote VPN (source):\nshow queue <source-queue> message-vpn <source-vpn> subscriptions",
    expected: "Local VPN (destination):\nQueue Oper State: Bound\nRemote Message VPN: <source-vpn>\n  Message Spool\n    Queue: <source-queue>\n    Queue Bind State: Up\n\nRemote VPN(source):\nSubscription: <list of subscribed topics>",
    commands: [
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Bridge.",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [
      "show client-profile * detail",
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable bridge throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show bridge <bridge-name> message-vpn <name> detail\"\n\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [
      "show bridge * detail",
      "show client-profile * detail"
    ]
  },
  {
    ref: "2.3",
    check: "VPN Replication (DR)",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.3.1",
    check: "Replication Bridge",
    description: "VPN Bridge for site replication is enabled with SSL and Client Certificate Authentication",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \nAt primary and standby sites:\n\"show message-vpn <name> replication detail\"\n\nAt replication (standby) site:\nshow bridge #MSGVPN_REPLICATION_BRIDGE message-vpn <name> detail",
    expected: "Admin status: Yes\nUsing Server Certificate:    Yes\nSSL: Yes\n\nAdmin State:                  Enabled\nConn Establisher:             Local\nInbound Oper State:           Ready-InSync\nOutbound Oper State:          NotApplicable\nQueue Oper State:             Bound\nUsing Server Certificate:    Yes\nSSL: Yes",
    commands: [
      "show message-vpn * replication",
      "show bridge #MSGVPN_REPLICATION_BRIDGE message-vpn * detail"
    ]
  },
  {
    ref: "2.3.2",
    check: "Replication Subscriptions",
    description: "Replication queue should have subscriptions as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show queue #MSGVPN_REPLICATION_DATA_QUEUE message-vpn <name> subscription\"",
    expected: "Subscription: <list of subscribed topics>",
    commands: [
      "show queue #MSGVPN_REPLICATION_DATA_QUEUE message-vpn * detail"
    ]
  },
  {
    ref: "2.3.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Replication",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [
      "show message-vpn * replication"
    ]
  },
  {
    ref: "2.3.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable replication throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show message-vpn <name> replication detail\"\n\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [
      "show message-vpn * replication"
    ]
  },
  {
    ref: "3",
    check: "Client Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "3.1",
    check: "Application Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "3.1.1",
    check: "Application reconnect parameters",
    description: "Ensure that Client applications are configured to retry their connection to the broker on disconnection",
    requirement: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    commands: []
  },
  {
    ref: "3.1.2",
    check: "Consumer clients re-subscribe or re-bind endpoint after reconnection",
    description: "Ensure that consumer clients are configured to re-subscribe to topics or re-connect to queue/topic-endpoint when reconnection occurs",
    requirement: "Consumer client will resume topics subscription or queue binding after reconnection",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Consumer client will resume topics subscription or queue binding after reconnection",
    commands: []
  },
  {
    ref: "3.1.3",
    check: "Client Connection Flapping",
    description: "Ensure that customer clients retain connections when sending streaming events and avoid flapping the client connection (continuous connect & disconnect)",
    requirement: "No client connection flapping",
    source: "Verify the broker system or event logs",
    expected: "No client connection flapping",
    commands: []
  },
  {
    ref: "3.1.4",
    check: "Client Messaging Rate",
    description: "Client application to include messaging rate be measured in its test procedure.",
    requirement: "Client applications can publish and subscribe messages at expected throughput",
    source: "Verify client throughput at customer's monitoring system (recommended) or broker metrics snapshot if no monitoring system available",
    expected: "Client applications can publish and subscribe messages at expected throughput",
    commands: []
  },
  {
    ref: "3.1.5",
    check: "DR Failover (if applicable)",
    description: "Ensure that customer clients have a procedure for connecting DR brokers and have the procedure be validated in its testing.",
    requirement: "Client applications can connect to DR brokers after being activated",
    source: "Verify the DR broker system or event logs",
    expected: "Client applications can connect to DR brokers after being activated",
    commands: []
  },
  {
    ref: "3.1.6",
    check: "DMQ Eligible Property (prior 10.26.0 SolOS)",
    description: "Publisher client application enable DMQ Eligible property for allowing DMQ message handling",
    requirement: "As needed according to requirements",
    source: "Persistent messaged enqueued in Solace broker has DMQ Eligible property value: 'Yes'",
    expected: "As needed according to requirements",
    commands: []
  },
  {
    ref: "4",
    check: "Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.1",
    check: "Client Access and Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.1.1",
    check: "Disable unused services",
    description: "Disable all Solace services and ports except those required. All non-secure ports are to be disabled. The only messaging service protocols to be enabled are: \n- SMF Secure\n- AMQP(SSL)",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"",
    expected: "See 1.1.7",
    commands: [
      "show service"
    ]
  },
  {
    ref: "4.1.2",
    check: "Disable “default” Message-vpn",
    description: "The default Message VPN should be disabled, particularly for deployments to production. Having the default Message VPN enabled may enable clients with an incorrect message VPN name to gain access to the broker.",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn default\"",
    expected: "default VPN is disabled",
    commands: [
      "show message-vpn *"
    ]
  },
  {
    ref: "4.1.3",
    check: "Disable “default” client-username",
    description: "Every message VPN comes with a “default” client username that cannot be deleted. When a client username is not provided for a connection, “default” would be assumed. For proper implementation of access control, the “default” client username shall be disabled. Otherwise, any applications can connect to the message VPN using this client username.",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username default\"",
    expected: "All default users are disabled",
    commands: [
      "show client-username default message-vpn *|show client-username * detail"
    ]
  },
  {
    ref: "4.1.4",
    check: "Use Client-Usernames",
    description: "Use a unique client username for each distinct application that will access your VPN. This is useful for audit purposes, and also allows each application and/or client to have a unique ACL. ",
    requirement: "",
    source: "Verify application design and configuration against the client usernames in broker.\n\nCLI/SEMP:\n \"show client-username *\"",
    expected: "Validation at client application",
    commands: [
      "show client-username *|show client-username * detail"
    ]
  },
  {
    ref: "4.1.5",
    check: "Use Passsword-less authentication where possible",
    description: "Enable Client Certificate authentication at VPNs as per design specification",
    requirement: "",
    source: "CLI/SEMP:\nVerify client certificate is enabled at message-vpn:\n \"show message-vpn <name>\"\n\nVerify client-certificate configuration:\n\"show client-certificate-authority ca-name * cert\" \n\nVerify certificate user is configured in client-username:\n\"show client-username *\"",
    expected: "Client authentication is enabled at message VPN\n\nClient certificate is registered\n\nCertificate user is enabled in client-username",
    commands: [
      "show message-vpn * detail",
      "show client-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "4.2",
    check: "Client Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.2.1",
    check: "Use ACL profiles for authorization\n(Client Connect)",
    description: "Use the client connect configuration settings to restrict the IP addresses which clients should be allowed to connect from (CIDR Format) ",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.2",
    check: "Use ACL profiles for authorization\n(Publish Topic)",
    description: "Use the Publish Topic settings of an ACL to control where the client is allowed to publish to, including wildcarded topics and queues.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.3",
    check: "Use ACL profiles for authorization\n(Subscribe Topic)",
    description: "Use the Subscribe Topic settings of an ACL to control where the client is allowed to subscribe to, including wildcarded topics.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.4",
    check: "Limit user access via Client Profiles",
    description: "Limit a client’s acess to the functions required by setting these in the client-profile accordingly as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "",
    commands: [
      "show client-profile * detail"
    ]
  },
  {
    ref: "4.3",
    check: "Management Access and Authorization",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.3.1",
    check: "Set default management access to none",
    description: "Ensure the management Default Global Access is set to none",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "See 1.5.2",
    commands: [
      "show authentication access-level default|show authentication access-level detail"
    ]
  },
  {
    ref: "4.3.2",
    check: "Limit access to management users and groups with “admin”,  \"read-write\", and \"mesh-manager\" permissions",
    description: "Management users and groups with “admin”, \"read-write\", and \"mesh-manager role can perform all or partial broker administration functions. Therefore, access to this role should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username *\"\n\nVerify ldap group role:\n\"show authentication access-level ldap\"\n\nVerify oauth group role:\n\"show oauth-profile * access-level\"",
    expected: "Only limited authorized users have admin and read-write permissions\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [
      "show username *|show username * detail",
      "show authentication access-level ldap",
      "show oauth-profile * access-level"
    ]
  },
  {
    ref: "4.3.3",
    check: "Limit message-vpn access with \"read-write\" permission",
    description: "Users and groups with any global management roles that have message-vpn \"read-write\" exception access can perform configuration changes at message-vpn level. Therefore, this exception access should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username * detail\"\n\nVerify ldap group role:\n\"show authentication access-level ldap group *\"\n\nVerify oauth group role:\n\"show oauth-profile * access-level detail\"",
    expected: "Only limited authorized users have message-vpn \"read-write\" access-level\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [
      "show username * detail",
      "show authentication access-level ldap detail",
      "show oauth-profile * access-level detail"
    ]
  },
  {
    ref: "4.3.4",
    check: "Limit access to CLI admin user",
    description: "Access to Solace broker default admin user must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Usage of admin user must be strictly controlled",
    expected: "Usage of admin user is strictly controlled",
    commands: []
  },
  {
    ref: "4.3.5",
    check: "Limit privilege access to host and container Linux shell",
    description: "Access to solace broker default support and root users must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Access to container host must be strictly controlled",
    expected: "Access to container host is strictly controlled",
    commands: []
  },
  {
    ref: "4.3.6",
    check: "Securely manage default management account passwords",
    description: "Securely manage the default management accounts with Privilege ID Management tool and procedure of the organization",
    requirement: "",
    source: "Securely manage default CLI admin user",
    expected: "Default CLI admin is securely managed",
    commands: []
  },
  {
    ref: "4.4",
    check: "Transport Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.4.1",
    check: "Use TLS for VPN bridges",
    description: "Use TLS/SSL for securing non loopback VPN bridge connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show bridge <name> detail\"",
    expected: "Remote VPNs use TLS Enabled",
    commands: [
      "show bridge *",
      "show bridge * detail"
    ]
  },
  {
    ref: "4.4.2",
    check: "Use HTTPS for management",
    description: "Use HTTPS for accessing the Solace management console over the WebUI",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\"show web-manager\"",
    expected: "See 1.1.6\nSEMP TCP 8080 (PlainText): Up/Down\nSEMP TCP 1943 (Secure): Up\n\nRedirect Manager Config Status : Enabled\nRedirect Manager Oper Status   : Up",
    commands: [
      "show service",
      "show web-manager"
    ]
  },
  {
    ref: "4.4.3",
    check: "Use TLS for Client Connections",
    description: "Use TLS/SSL for securing client connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show stats client detail\"\n\nReview event log\n\nAnd verify at client application configuration",
    expected: "Clients are connected on secure port",
    commands: [
      "show stats client detail"
    ]
  },
  {
    ref: "4.4.4",
    check: "Disable TLS connection downgrade",
    description: "Client connections over TLS can be downgraded, meaning, the client still authenticates over a TLS connection but the transportation of the messages that follows is in plain-text. Ensure this is disabled unless required",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show client-profile <name> detail\"",
    expected: "SSL to plain text downgrade allowed: No\n  \nSSL                                   \n    Allow Downgrade to Plain Text       : No",
    commands: [
      "show message-vpn * detail",
      "show client-profile * detail"
    ]
  },
  {
    ref: "4.4.5",
    check: "Use TLS v1.2, disable TLS v1.1 and v1.0",
    description: "Disable TLS v1.1 on the software broker (disabled by default)",
    requirement: "",
    source: "CLI/SEMP:\n \"show ssl allow-tls-version\"",
    expected: "Allowed TLS versions: 1.2",
    commands: [
      "show ssl allow-tls-version|show ssl"
    ]
  },
  {
    ref: "4.4.6",
    check: "Use SHA-256 not SHA-1",
    description: "Use SHA-256 to generate certificates. While the broker also supports SHA-1 Cipher suites, SHA-1 is now considered feasibly breakable.",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl server-certificate detail\"",
    expected: "Signature Algorithm: sha256",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "4.4.7",
    check: "Enable only required Cipher suites",
    description: "Enable cipher suites as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl cipher-suite-list management\"\n\n\"show ssl cipher-suite-list msg-backbone\"",
    expected: "",
    commands: [
      "show ssl cipher-suite-list management",
      "show ssl cipher-suite-list msg-backbone"
    ]
  },
  {
    ref: "4.5",
    check: "Network Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.5.1",
    check: "Place the Solace broker behind a firewall",
    description: "Solace broker should be placed behind the firewall so that it is protected against Distributed Denial of Service (DDOS) attacks in general.",
    requirement: "",
    source: "Validation at network configuration",
    expected: "",
    commands: []
  },
  {
    ref: "4.5.2",
    check: "Only expose services and ports as required",
    description: "Only expose Solace appropriate ports for external access.",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\nContainer runtime service port mappings",
    expected: "See \n1.1.6 (management service)\n1.1.7 (messaging services)",
    commands: [
      "show service"
    ]
  },
  {
    ref: "4.6",
    check: "Audit and Logging",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.6.1",
    check: "Centralized Syslog Forwarding",
    description: "Forward Solace syslogs to centralized Syslog servers for both real time monitoring and after-the-fact analysis and troubleshooting.",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: []
  },
  {
    ref: "4.6.2",
    check: "Enable Command Logging",
    description: "Solace provides a ‘command’ log that captures commands issued to the appliance along with the user that issued them. It is recommended that command logging is enabled for audit trail purposes. (This is the default setting).\n\n“show” commands should be silenced to ensure that the command log file does not fill up unnecessarily.",
    requirement: "",
    source: "CLI/SEMP:\n \"show logging command\"",
    expected: "CLI                   config\nSEMP/mgmt     config\nSEMP/msgbus config",
    commands: [
      "show logging command"
    ]
  },
  {
    ref: "4.6.3",
    check: "Monitoring Authentication Log Messages",
    description: "The following shows a list of recommended Syslog messages to be monitored concerning the authentication of users/ clients for audit purposes. As authentication is the first step against unauthorized access, logging of those events provides clues to unauthorized connection attempts.\n\n1.\tSYSTEM_AUTHENTICATION_SESSION_CLOSED\n2.\tSYSTEM_AUTHENTICATION_SESSION_DENIED\n3.\tSYSTEM_AUTHENTICATION_SESSION_OPENED\n4.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_DENIED\n5.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_GRANTED",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: []
  },
  {
    ref: "5",
    check: "Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.1",
    check: "Infrastructure Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.1.1",
    check: "Disk Performance",
    description: "Use disk test tool to measure external storage performance",
    requirement: "Establish baseline of disk performance",
    source: "Software broker:\nOS:\nsolacectl shell\nsoldisktest --dir=/usr/sw/internalSpool",
    expected: "Disk write performance is within acceptable rate",
    commands: []
  },
  {
    ref: "5.1.2",
    check: "LAN Performance (recommended)",
    description: "Use iperf tool to measure Local Area Network performance between Solace broker messaging network segment and client application network segment",
    requirement: "Establish baseline of LAN performance",
    source: "Use network iperf tool to test network throughput between broker messaging network segment and client network segment",
    expected: "Establish baseline of LAN performance",
    commands: []
  },
  {
    ref: "5.1.3",
    check: "WAN Performance (recommended)",
    description: "Use iperf tool to measure Wide Area Network performance between Solace broker network segment at one data center  and another data center of Solace broker and/or client application network segment",
    requirement: "Establish baseline of WAN performance",
    source: "Use network iperf tool to test network throughput between two data centers network segments",
    expected: "Establish baseline of WAN performance",
    commands: []
  },
  {
    ref: "5.2",
    check: "Broker Connectivity",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.2.1",
    check: "Management connectivity",
    description: "The Solace broker must be reachable over the management interface at SSH and HTTPS protocols from external servers on the network",
    requirement: "",
    source: "Software broker:\nOS:\nssh sysadmin@<solace-ip>\nCLI:\nssh -p 2222 <cli-admin>@<solace-ip>\n\nWeb browser or SolAdmin:\nhttps://<solace-fqdn>:1943\nUser: <cli-admin>",
    expected: "Succesfully login to CLI and WebUI",
    commands: []
  },
  {
    ref: "5.2.2",
    check: "File Transfer Connectivity",
    description: "File transfer users on the Solace broker must be able to log on and upload/download files",
    requirement: "",
    source: "Software broker:\nsftp -P 2222 <file-transfer-user>@<solace-ip>",
    expected: "Successfully login to FTP",
    commands: []
  },
  {
    ref: "5.2.3",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on plain-text port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcp://<ip-address>:55555 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: []
  },
  {
    ref: "5.2.4",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on secure port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: []
  },
  {
    ref: "5.2.5",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other> protocol",
    commands: []
  },
  {
    ref: "5.2.6",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol on secure port",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other>  protocol on secure port",
    commands: []
  },
  {
    ref: "5.3",
    check: "Messaging Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.3.1",
    check: "Direct Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -stl=<topicname>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: []
  },
  {
    ref: "5.3.2",
    check: "Guaranteed Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000 -mt=persistent\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -sql=<queuename>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: []
  },
  {
    ref: "5.4",
    check: "Fault Tolerance",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.4.1",
    check: "Client HA failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing HA failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-node-ip-address>:55443,tcps:<backup-node-ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2000 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: []
  },
  {
    ref: "5.4.2",
    check: "Graceful HA failovers",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Primary node is active. Backup node is standby",
    requirement: "",
    source: "Primary node:\nCLI/SEMP:\nenable\nconfigure\nredundancy release-activity\n(wait for approx 10 seconds and verify the redundancy status)\nshow redundancy\n(re-enable redundancy status)\nredundancy no release-activity",
    expected: "Primary Node:\nActivity Status: Mate Active",
    commands: []
  },
  {
    ref: "5.4.3",
    check: "Graceful HA failback",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Backup node:\nCLI/SEMP:\nenable\nadmin\nredundancy revert-activity\nshow redundancy",
    expected: "Backup Node:\nActivity Status: Mate Active",
    commands: []
  },
  {
    ref: "5.4.4",
    check: "Abrupt HA failovers",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Primary node is active. Backup Node is Standby",
    requirement: "",
    source: "Reboot Primary VM:\nOS:\nreboot\n\nVerify on backup node:\nshow redundancy\n",
    expected: "Backup Node:\nActivity Status: Local Active",
    commands: []
  },
  {
    ref: "5.4.5",
    check: "Abrupt HA failback",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Reboot Backup VM:\nOS:\nreboot\n\nVerify on primary node:\nshow redundancy\n",
    expected: "Primary Node:\nActivity Status: Local Active",
    commands: []
  },
  {
    ref: "5.4.6",
    check: "Client DR failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing DR failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription\n<topicname> is added in VPN replication replicated topic with SYNC mode",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-site-primary-ip>:55443,tcps:<primary-site-backup-ip>:55443,tcps:<dr-site-primary-ip>:55443,tcps:<dr-site-backup-ip>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2048 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: []
  },
  {
    ref: "5.4.7",
    check: "DR failovers",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. Primary site VPN is active. DR site VPN is standby",
    requirement: "",
    source: "Primary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\n\nwait for 1 minute\n\nDR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active",
    expected: "Primary site VPN:\nLocal Status: Standby\n\nDR site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: []
  },
  {
    ref: "5.4.8",
    check: "DR failback",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. DR site VPN is active. Primary site VPN is standby",
    requirement: "",
    source: "DR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\nshow message-vpn <name>\n\nwait for 1 minute\n\nPrimary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active\nshow message-vpn <name>\nshow replication",
    expected: "DR site VPN:\nLocal Status: Standby\n\nPrimary site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: []
  },
  {
    ref: "5.5",
    check: "Monitoring Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.1",
    check: "Monitoring Tool Integration",
    description: "The monitoring solution for Solace ( Syslog/SEMP)) must be fully tested against the monitoring use cases to ensure the monitoring solution operates as expected and meets requirements",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.2",
    check: "Monitoring Host Connectivity",
    description: "Any monitoring hosts must be able to retrieve data from the Solace appliance via CLI/SEMP",
    requirement: "",
    source: "Verify Metrics Monitoring server can connect and collect metrics from management IP",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.3",
    check: "Alerting",
    description: "Verify that the correct monitoring alert recipients are configured and they receive the corresponding alerts",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.6",
    check: "Application Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.6.1",
    check: "Application connectivity",
    description: "Validate application connectivity",
    requirement: "Client authentication is successful and no connection flapping",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "Client authentication is successful and no connection flapping",
    commands: []
  },
  {
    ref: "5.6.2",
    check: "End-to-end event flows",
    description: "Validate that the application can send/receive messages over the bridge link",
    requirement: "All clients can send and receive messages as designed",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "All clients can send and receive messages as designed",
    commands: []
  },
  {
    ref: "5.6.3",
    check: "Applications should withstand HA failover",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an HA failover - applications should automatically reconnect to the backup Solace broker on an HA failover",
    requirement: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    source: "While publishing and subscribing  messages, perform HA failover",
    expected: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    commands: []
  },
  {
    ref: "5.6.4",
    check: "DR Replication",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an DR (Site) failover as designed in DR activation procedure.",
    requirement: "Clients can send and receive messages at DR brokers",
    source: "Perform DR failover procedure",
    expected: "Validation at client application",
    commands: []
  },
  {
    ref: "5.7",
    check: "Support Readiness",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.7.1",
    check: "Support Hotline",
    description: "New Solace customer should be familiar of product support contact methods",
    requirement: "Customer can contact support hotline and receive response within expected response time",
    source: "Simulate a hotline call",
    expected: "Customer can contact support hotline and receive response within expected response time",
    commands: []
  }
];

export function isGroupRef(ref) {
  return /^\d+$/.test(ref);
}

export function isCategoryRef(ref) {
  return /^\d+\.\d+$/.test(ref);
}

export function isCheckRef(ref) {
  return /^\d+\.\d+\.\d+$/.test(ref);
}

// Splits a commands entry into its alternatives.
export function commandAlternatives(entry) {
  return String(entry).split("|").map((value) => value.trim()).filter(Boolean);
}

// Every distinct command a check may ask for, across all alternatives.
export function allRequestedCommands() {
  const commands = new Set();
  for (const check of CHECKS) {
    for (const entry of check.commands || []) {
      for (const alt of commandAlternatives(entry)) commands.add(alt);
    }
  }
  return [...commands];
}
