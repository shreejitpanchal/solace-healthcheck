const BASE_HEADER_ROW_1 = ["#", "Control Item", "Control Statement", "Passing Criteria (TBD)", "Software Broker", "", ""];
const BASE_HEADER_ROW_2 = ["", "", "", "", "Validation Method", "Expected Result", "Actual Output / Value"];

const CHECKS = [
  {
    ref: "1",
    check: "Group: System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.1",
    check: "Category: Basic System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.1.1",
    check: "Management Link",
    description: "Management interface shoud be detected on Solace broker ",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show interface intf0\"",
    expected: "Interface: intf0\n  Enabled: yes\n  Operational State: Up\n  Link detected: yes",
    commands: [
      "show interface intf0"
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.1.2",
    check: "ADB Links",
    description: "For HA pairs only, the ADB links should be established between active and backup nodes",
    requirement: "As stated",
    source: "NA",
    expected: "NA",
    commands: [],
    hardcodedOutput: "NA"
  },
  {
    ref: "1.1.3",
    check: "System POST",
    description: "The System Power On Self Test (POST) should be successully passed",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show system post\"",
    expected: "Overall Power-On Self Test (POST) Status: PASSED",
    commands: [
      "show system post"
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.1.7",
    check: "Messaging Service Configuration",
    description: "Only the required messaging services are enabled as per design specification",
    requirement: "SMF (Secure)",
    source: "CLI/SEMP:\n \"show service\"\n\n\"show message-vpn <vpn-name> service\"",
    expected: "Broker Enabled Services:\n- SMF\n\nMessage VPN Enabled Service:\n- SMF (Secure)",
    commands: [],
    hardcodedOutput: "Ignore"
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.1.10",
    check: "DNS Server Configuration",
    description: "Redundant DNS servers are configured for each Solace broker",
    requirement: "",
    source: "OS (Software):\ncat /etc/resolv.conf",
    expected: "nameserver <dns ip>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.1.11",
    check: "NTP Server Configuration",
    description: "NTP servers must be configured in order to synchronise the Solace broker's clock with an NTP server and the correct timezone should be applied",
    requirement: "",
    source: "OS (Software):\nntpstat\ntimedatectl status",
    expected: "ntpstat output: synchronized\n\nTime zone: <your-timezone>\n\nSystem clock synchronized: yes or \nNTP synchronized: yes\n\nNTP service: active or \nNTP enabled: yes\n",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.2",
    check: "Message Spool Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.2.1",
    check: "Storage Externalization",
    description: "Solace event brokers' storage should be mounted on external block storage",
    requirement: "Size: xx GB",
    source: "OS (Software):\nVerify volume mapping to container directory: /var/lib/solace",
    expected: "Solace Storage Elements are mounted on external block device",
    commands: [],
    hardcodedOutput: "Verified"
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.3",
    check: "Fault-Tolerant Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.3.1",
    check: "Redundancy ",
    description: "Solace brokers deployed as an HA pair must have the redundancy service configured and enabled. Matelink should be SSL enabled",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show redundancy detail\"",
    expected: "Configuration Status     : Enabled\nRedundancy Status      : Up\nADB Link To Mate         : Up\nADB Hello To Mate        : Up\n  Mate-Link Connect Via  : \n    Remote Port          : 8741\n    SSL                  : Yes",
    commands: [
      "show redundancy detail"
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.3.2",
    check: "Config-Sync ",
    description: "Solace brokers deployed as an HA pair must have the Config-Sync service enabled in order to synchronise configuration parameters. SSL should be enabled",
    requirement: "As stated",
    source: "CLI/SEMP:\n\"show config-sync\"",
    expected: "Admin Status: Enabled\nOper Status: Up\nSSL Enabled: Yes",
    commands: [
      "show config-sync"
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.4",
    check: "External Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.4.1",
    check: "LDAP Profile Configuration",
    description: "LDAP Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show ldap-profile <profile-name> detail\"",
    expected: "Admin Status: Enabled\nAdmin DN: <LDAP query user>\nSTARTTLS: Yes/No\nSearch:\nBase DN: <base search dn>\nLDAP Server Index #: <ldap-server-fqdn>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.4.2",
    check: "Oauth Profile Configuration",
    description: "Oauth Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show authentication user-class cli-semp\"\n\n \"show oauth-profile <profile-name> detail\"",
    expected: "Default Oauth Profile: <profile-name>\n\nAdmin Status: Enabled\nActive: Yes\nClient ID: <oauth-id>\nClient Secret Configured: Yes\nUsername Claim: <assignd>\nGroup Claim: <asigned>\nIssuer: <configured>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5",
    check: "Management User Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5.1",
    check: "Global CLI Users ",
    description: "Global CLI and File transfer Users  should be configured as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show username *\"\n\"show username * detail\"",
    expected: "Only authorized internal CLI and filetransfer users are created.",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5.2",
    check: "Default Global Access",
    description: "Default Global Access is set to none",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "Access-Level Configuration:\n  Default:\n    Global Acces Level: none",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5.3",
    check: "CLI Authentication type",
    description: "CLI authentication type is configured as per design specification:\nAuth-type:\nInternal\nLDAP\nRadius",
    requirement: "",
    source: "CLI/SEMP:\nshow authentication access-level detail",
    expected: "CLI and SEMP user class:\n  auth-type:  <type>\n  profile-name: <profile-name>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5.4",
    check: "CLI LDAP Authorization Group",
    description: "LDAP Groups are assigned to one of the following permissions as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level ldap\"\n\n \"show authentication access-level ldap detail\"",
    expected: "Only authorized LDAP groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.5.5",
    check: "CLI Oauth Authorization Group",
    description: "OAuth Groups are assigned to one of the following permissions as per design specification:\nread-only\nmesh-manager\nread-write\nadmin",
    requirement: "",
    source: "CLI/SEMP:\n \"show oath-profile <oauth-profile-name> access-level\"\n\n \"show oath-profile <oauth-profile-name> access-level detail\"",
    expected: "Only authorized Oauth groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.6",
    check: "Monitoring Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.6.1",
    check: "Syslog Forwarding",
    description: "Local Syslog log files must be forwarded to remote hosts for archival and retention ",
    requirement: "",
    source: "CLI/SEMP:\n\"show syslog\"",
    expected: "Facilities: event system\nHosts: <syslog server ip:port>\nTransport: TCP/UDP",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.6.2",
    check: "Syslog Server",
    description: "Solace Logs are recorded in Syslog Server",
    requirement: "",
    source: "Verify at external Syslog Server",
    expected: "Broker event and system logs are recorded in external syslog server",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.6.3",
    check: "Metrics Monitoring",
    description: "Solace metrics are collected at monitoring server as per design specification",
    requirement: "",
    source: "Verify at external Monitoring Server",
    expected: "Broker metrics are recorded in external monitoring server",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.7",
    check: "Backup Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.7.1",
    check: "Scheduled Backup Configuration",
    description: "A scheduled backup must be configured for all Solace brokers to the local file system with a retention period of XX copies as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show backup\"",
    expected: "Schedule: <day> <time>\nMax Backups: <number of retention>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.7.2",
    check: "Backup Archival",
    description: "The local configuration backups must be transferred to a remote location for retention and archival if required for retention beyond the \u201cmax-backups\u201d configuration on the broker scheduled backup.",
    requirement: "",
    source: "External scheduling for collecting backup file from Solace broker",
    expected: "Backup files are copied to external storage",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.8",
    check: "Certificates",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.9",
    check: "DR Replication Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.9.1",
    check: "Replication",
    description: "Replication Mate is configured as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \n\"show replication\"",
    expected: "Replication Mate: v:<router-name>\n    Plain Text:      <ip/hostname>:55555\n    Compressed: <ip/hostname>:55003\n    SSL:               <ip/hostname>:55443\nSSL:\n  Trusted Common Names: <certificate CN>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.9.2",
    check: "Config-Sync",
    description: "Replication Config-sync between the active and standby site is configured (with SSL enabled.)",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show replication\"",
    expected: "ConfigSync:\n  Bridge:                          \n    Admin State: Enabled\n    State: Up\nSSL: Yes/No",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.10",
    check: "Host System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.10.1",
    check: "Compute Resources",
    description: "Solace broker workload is allocated with sufficient CPU and RAM according to the broker size and other scaling parameters.",
    requirement: "",
    source: "",
    expected: "",
    commands: [
      "show system detail"
    ],
    hardcodedOutput: ""
  },
  {
    ref: "1.10.2",
    check: "Virtual Machine Network",
    description: "Virtual Network Interface is assigned with sufficient bandwidth.",
    requirement: "1Gbps or higher\nVmware: use VMX3",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.10.3",
    check: "Storage",
    description: "High performance external storage to be assigned for Solace broker.\nAppliance: SAN SSD storage\nSoftware/Cloud: Volume mapping from SSD Block storage\n",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.10.4",
    check: "Container Runtime Network",
    description: "High performance container runtime network must be used for Solace software broker\n",
    requirement: "Docker/Podman: Use host or bridge network",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.10.5",
    check: "Additional co-located services",
    description: "Co-located services running on the same host as Solace broker must have additional CPU, memory, and disk resources being allocated. Each service should be reviewed to ensure it does not negatively impact broker's performance.",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.11",
    check: "System Health",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "1.11.1",
    check: "No System Alarms",
    description: "There should be no system alarms displayed for the Solace appliance - any alarms displayed should be acted upon to remediate the situation",
    requirement: "",
    source: "NA",
    expected: "NA",
    commands: [],
    hardcodedOutput: "NA"
  },
  {
    ref: "1.11.2",
    check: "No recurring errors in Logs",
    description: "There should be no recurring errors in the System Log indicative of an error condition",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show log system lines 100\"",
    expected: "No recurring error in System Log",
    commands: [],
    hardcodedOutput: "Pending"
  },
  {
    ref: "2",
    check: "Message-VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1",
    check: "Basic VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.2",
    check: "VPN Authentication and Authorization",
    description: "Message VPN should be configured with authentication and authorization method as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n \"show message-vpn <name> authorization\"",
    expected: "BASIC:\nBasic Authentication: Enabled\n  Auth Type: internal/ldap\n  Auth Profile: <ldap-profile-name>\n\nCLIENT CERTIFICATE:\nClient Certificate Authentication :  Enabled/Disabled\n\nOAUTH:\nOauth Authentication Enabled: Yes/No\n(oauth) Default Profile Name: <oauth-profile>\n\nAUTHORIZATION TYPE:\nAuthorization Type: Internal/ldap",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.3",
    check: "VPN Limits",
    description: "VPN Resouces should be set as per connection scaling tier and the properties of message-spool: \n- size\n- connections\n- subscriptions\n- message-spool quota\n- ingress flows\n- egress flows\nare configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show message-spool message-vpn <name>\"",
    expected: "Max Incoming Connections: 1000\n\nMaximum Queues and Topic-Endpoints:1000\nMax Allowed Spool Usage (MB): 60000\nMax Egress Flows: 1000\nMax Ingress Flows: 1000",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.4",
    check: "VPN Messaging Service Configuration",
    description: "Only the required messaging services are enabled",
    requirement: "SMF",
    source: "CLI/SEMP:\n \"show message-vpn <name> service\"",
    expected: "SMF TCP 55443: Up",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.5",
    check: "Client Profiles",
    description: "Client Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "App Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: No\nAllow Shared Subscriptions: No\n\nBridge Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: Yes\nAllow Shared Subscriptions: No",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.6",
    check: "ACL Profiles",
    description: "ACL Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile *\"",
    expected: "Conn: n, exception: [list]\nPub: n, exception: [list]\nSub: n, exception: [list]\nShare: y",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.7",
    check: "Client Usernames",
    description: "Client Usernames should be created as per design specification and assigned to correct client profile and acl profile\nDefault username should be disabled",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username * detail\"",
    expected: "Username: default\nEnabled: No\n\nUsername: <username>\nMessage VPN: <vpn>\nClient Profile: <client-profile>\nACL Profile: <acl-profile>\nEnabled: yes",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.8",
    check: "Queue",
    description: "All queues should be created as per design specification and configured will appropriate permissions (owner, permissions and access-type)",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * detail\"",
    expected: "App Queue:\nName: <queue name>\nMessage VPN: <vpn>\nOwner: <owner name>\nAll Other Permission: <Consume/Read-Only/No Access>\n\nRemote Bridge Queue:\nName: <queue name>\nMessage VPN: <vpn>\nAccess Type: Exclusive\nOwner: <bridge user>\nAll Other Permission: <Consume/Read-Only/No Access>\nMax Bind Count: 1",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.1.9",
    check: "Topic to Queue mapping",
    description: "Queues have topic subscriptions as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * subscriptions\"",
    expected: "Queue subscribes only to required topics",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.2",
    check: "VPN Bridge Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.2.1",
    check: "VPN Bridge",
    description: "VPN Bridges should be configured between VPNs as per design specification, such as:\nAuthentication scheme\nTransport property\nMax TTL\nSpool queue and window size",
    requirement: "",
    source: "CLI/SEMP: \n\"show bridge * detail\"",
    expected: "Unidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\n\nBidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\nOutbound Oper State: Up",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.2.2",
    check: "Remote Queue Subscriptions",
    description: "Bridge remote queue should be configured with subscriptions as per design specification",
    requirement: "",
    source: "Local VPN (destination):\nCLI/SEMP: \n\"show bridge <name> message-vpn <vpn> detail\"\n\nRemote VPN (source):\nshow queue <source-queue> message-vpn <source-vpn> subscriptions",
    expected: "Local VPN (destination):\nQueue Oper State: Bound\nRemote Message VPN: <source-vpn>\n  Message Spool\n    Queue: <source-queue>\n    Queue Bind State: Up\n\nRemote VPN(source):\nSubscription: <list of subscribed topics>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.2.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Bridge.",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.2.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable bridge throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show bridge <bridge-name> message-vpn <name> detail\"\n\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.3",
    check: "VPN Replication (DR)",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.3.1",
    check: "Replication Bridge",
    description: "VPN Bridge for site replication is enabled with SSL and Client Certificate Authentication",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \nAt primary and standby sites:\n\"show message-vpn <name> replication detail\"\n\nAt replication (standby) site:\nshow bridge #MSGVPN_REPLICATION_BRIDGE message-vpn <name> detail",
    expected: "Admin status: Yes\nUsing Server Certificate:    Yes\nSSL: Yes\n\nAdmin State:                  Enabled\nConn Establisher:             Local\nInbound Oper State:           Ready-InSync\nOutbound Oper State:          NotApplicable\nQueue Oper State:             Bound\nUsing Server Certificate:    Yes\nSSL: Yes",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.3.2",
    check: "Replication Subscriptions",
    description: "Replication queue should have subscriptions as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show queue #MSGVPN_REPLICATION_DATA_QUEUE message-vpn <name> subscription\"",
    expected: "Subscription: <list of subscribed topics>",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.3.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Replication",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "2.3.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable replication throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show message-vpn <name> replication detail\"\n\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3",
    check: "Client Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1",
    check: "Application Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.1",
    check: "Application reconnect parameters",
    description: "Ensure that Client applications are configured to retry their connection to the broker on disconnection",
    requirement: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.2",
    check: "Consumer clients re-subscribe or re-bind endpoint after reconnection",
    description: "Ensure that consumer clients are configured to re-subscribe to topics or re-connect to queue/topic-endpoint when reconnection occurs",
    requirement: "Consumer client will resume topics subscription or queue binding after reconnection",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Consumer client will resume topics subscription or queue binding after reconnection",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.3",
    check: "Client Connection Flapping",
    description: "Ensure that customer clients retain connections when sending streaming events and avoid flapping the client connection (continuous connect & disconnect)",
    requirement: "No client connection flapping",
    source: "Verify the broker system or event logs",
    expected: "No client connection flapping",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.4",
    check: "Client Messaging Rate",
    description: "Client application to include messaging rate be measured in its test procedure.",
    requirement: "Client applications can publish and subscribe messages at expected throughput",
    source: "Verify client throughput at customer's monitoring system (recommended) or broker metrics snapshot if no monitoring system available",
    expected: "Client applications can publish and subscribe messages at expected throughput",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.5",
    check: "DR Failover (if applicable)",
    description: "Ensure that customer clients have a procedure for connecting DR brokers and have the procedure be validated in its testing.",
    requirement: "Client applications can connect to DR brokers after being activated",
    source: "Verify the DR broker system or event logs",
    expected: "Client applications can connect to DR brokers after being activated",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "3.1.6",
    check: "DMQ Eligible Property (prior 10.26.0 SolOS)",
    description: "Publisher client application enable DMQ Eligible property for allowing DMQ message handling",
    requirement: "As needed according to requirements",
    source: "Persistent messaged enqueued in Solace broker has DMQ Eligible property value: 'Yes'",
    expected: "As needed according to requirements",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4",
    check: "Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.1",
    check: "Client Access and Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
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
    ],
    hardcodedOutput: ""
  },
  {
    ref: "4.1.2",
    check: "Disable \u201cdefault\u201d Message-vpn",
    description: "The default Message VPN should be disabled, particularly for deployments to production. Having the default Message VPN enabled may enable clients with an incorrect message VPN name to gain access to the broker.",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn default\"",
    expected: "default VPN is disabled",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.1.3",
    check: "Disable \u201cdefault\u201d client-username",
    description: "Every message VPN comes with a \u201cdefault\u201d client username that cannot be deleted. When a client username is not provided for a connection, \u201cdefault\u201d would be assumed. For proper implementation of access control, the \u201cdefault\u201d client username shall be disabled. Otherwise, any applications can connect to the message VPN using this client username.",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username default\"",
    expected: "All default users are disabled",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.1.4",
    check: "Use Client-Usernames",
    description: "Use a unique client username for each distinct application that will access your VPN. This is useful for audit purposes, and also allows each application and/or client to have a unique ACL. ",
    requirement: "",
    source: "Verify application design and configuration against the client usernames in broker.\n\nCLI/SEMP:\n \"show client-username *\"",
    expected: "Validation at client application",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.1.5",
    check: "Use Passsword-less authentication where possible",
    description: "Enable Client Certificate authentication at VPNs as per design specification",
    requirement: "",
    source: "CLI/SEMP:\nVerify client certificate is enabled at message-vpn:\n \"show message-vpn <name>\"\n\nVerify client-certificate configuration:\n\"show client-certificate-authority ca-name * cert\" \n\nVerify certificate user is configured in client-username:\n\"show client-username *\"",
    expected: "Client authentication is enabled at message VPN\n\nClient certificate is registered\n\nCertificate user is enabled in client-username",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.2",
    check: "Client Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.2.1",
    check: "Use ACL profiles for authorization\n(Client Connect)",
    description: "Use the client connect configuration settings to restrict the IP addresses which clients should be allowed to connect from (CIDR Format) ",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.2.2",
    check: "Use ACL profiles for authorization\n(Publish Topic)",
    description: "Use the Publish Topic settings of an ACL to control where the client is allowed to publish to, including wildcarded topics and queues.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.2.3",
    check: "Use ACL profiles for authorization\n(Subscribe Topic)",
    description: "Use the Subscribe Topic settings of an ACL to control where the client is allowed to subscribe to, including wildcarded topics.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.2.4",
    check: "Limit user access via Client Profiles",
    description: "Limit a client\u2019s acess to the functions required by setting these in the client-profile accordingly as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3",
    check: "Management Access and Authorization",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.1",
    check: "Set default management access to none",
    description: "Ensure the management Default Global Access is set to none",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "See 1.5.2",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.2",
    check: "Limit access to management users and groups with \u201cadmin\u201d,  \"read-write\", and \"mesh-manager\" permissions",
    description: "Management users and groups with \u201cadmin\u201d, \"read-write\", and \"mesh-manager role can perform all or partial broker administration functions. Therefore, access to this role should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username *\"\n\nVerify ldap group role:\n\"show authentication access-level ldap\"\n\nVerify oauth group role:\n\"show oath-profile * access-level\"",
    expected: "Only limited authorized users have admin and read-write permissions\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.3",
    check: "Limit message-vpn access with \"read-write\" permission",
    description: "Users and groups with any global management roles that have message-vpn \"read-write\" exception access can perform configuration changes at message-vpn level. Therefore, this exception access should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username * detail\"\n\nVerify ldap group role:\n\"show authentication access-level ldap group *\"\n\nVerify oauth group role:\n\"show oath-profile * access-level detail\"",
    expected: "Only limited authorized users have message-vpn \"read-write\" access-level\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.4",
    check: "Limit access to CLI admin user",
    description: "Access to Solace broker default admin user must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Usage of admin user must be strictly controlled",
    expected: "Usage of admin user is strictly controlled",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.5",
    check: "Limit privilege access to host and container Linux shell",
    description: "Access to solace broker default support and root users must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Access to container host must be strictly controlled",
    expected: "Access to container host is strictly controlled",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.3.6",
    check: "Securely manage default management account passwords",
    description: "Securely manage the default management accounts with Privilege ID Management tool and procedure of the organization",
    requirement: "",
    source: "Securely manage default CLI admin user",
    expected: "Default CLI admin is securely managed",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4",
    check: "Transport Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.1",
    check: "Use TLS for VPN bridges",
    description: "Use TLS/SSL for securing non loopback VPN bridge connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show bridge <name> detail\"",
    expected: "Remote VPNs use TLS Enabled",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.2",
    check: "Use HTTPS for management",
    description: "Use HTTPS for accessing the Solace management console over the WebUI",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\"show web-manager\"",
    expected: "See 1.1.6\nSEMP TCP 8080 (PlainText): Up/Down\nSEMP TCP 1943 (Secure): Up\n\nRedirect Manager Config Status : Enabled\nRedirect Manager Oper Status   : Up",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.3",
    check: "Use TLS for Client Connections",
    description: "Use TLS/SSL for securing client connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show stats client detail\"\n\nReview event log\n\nAnd verify at client application configuration",
    expected: "Clients are connected on secure port",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.4",
    check: "Disable TLS connection downgrade",
    description: "Client connections over TLS can be downgraded, meaning, the client still authenticates over a TLS connection but the transportation of the messages that follows is in plain-text. Ensure this is disabled unless required",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show client-profile <name> detail\"",
    expected: "SSL to plain text downgrade allowed: No\n  \nSSL                                   \n    Allow Downgrade to Plain Text       : No",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.5",
    check: "Use TLS v1.2, disable TLS v1.1 and v1.0",
    description: "Disable TLS v1.1 on the software broker (disabled by default)",
    requirement: "",
    source: "CLI/SEMP:\n \"show ssl allow-tls-version\"",
    expected: "Allowed TLS versions: 1.2",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.6",
    check: "Use SHA-256 not SHA-1",
    description: "Use SHA-256 to generate certificates. While the broker also supports SHA-1 Cipher suites, SHA-1 is now considered feasibly breakable.",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl server-certificate detail\"",
    expected: "Signature Algorithm: sha256",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.4.7",
    check: "Enable only required Cipher suites",
    description: "Enable cipher suites as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl cipher-suite-list management\"\n\n\"show ssl cipher-suite-list msg-backbone\"",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.5",
    check: "Network Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.5.1",
    check: "Place the Solace broker behind a firewall",
    description: "Solace broker should be placed behind the firewall so that it is protected against Distributed Denial of Service (DDOS) attacks in general.",
    requirement: "",
    source: "Validation at network configuration",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.5.2",
    check: "Only expose services and ports as required",
    description: "Only expose Solace appropriate ports for external access.",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\nContainer runtime service port mappings",
    expected: "See \n1.1.6 (management service)\n1.1.7 (messaging services)",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.6",
    check: "Audit and Logging",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.6.1",
    check: "Centralized Syslog Forwarding",
    description: "Forward Solace syslogs to centralized Syslog servers for both real time monitoring and after-the-fact analysis and troubleshooting.",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.6.2",
    check: "Enable Command Logging",
    description: "Solace provides a \u2018command\u2019 log that captures commands issued to the appliance along with the user that issued them. It is recommended that command logging is enabled for audit trail purposes. (This is the default setting).\n\n\u201cshow\u201d commands should be silenced to ensure that the command log file does not fill up unnecessarily.",
    requirement: "",
    source: "CLI/SEMP:\n \"show logging command\"",
    expected: "CLI                   config\nSEMP/mgmt     config\nSEMP/msgbus config",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "4.6.3",
    check: "Monitoring Authentication Log Messages",
    description: "The following shows a list of recommended Syslog messages to be monitored concerning the authentication of users/ clients for audit purposes. As authentication is the first step against unauthorized access, logging of those events provides clues to unauthorized connection attempts.\n\n1.\tSYSTEM_AUTHENTICATION_SESSION_CLOSED\n2.\tSYSTEM_AUTHENTICATION_SESSION_DENIED\n3.\tSYSTEM_AUTHENTICATION_SESSION_OPENED\n4.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_DENIED\n5.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_GRANTED",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5",
    check: "Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.1",
    check: "Infrastructure Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.1.1",
    check: "Disk Performance",
    description: "Use disk test tool to measure external storage performance",
    requirement: "Establish baseline of disk performance",
    source: "Software broker:\nOS:\nsolacectl shell\nsoldisktest --dir=/usr/sw/internalSpool",
    expected: "Disk write performance is within acceptable rate",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.1.2",
    check: "LAN Performance (recommended)",
    description: "Use iperf tool to measure Local Area Network performance between Solace broker messaging network segment and client application network segment",
    requirement: "Establish baseline of LAN performance",
    source: "Use network iperf tool to test network throughput between broker messaging network segment and client network segment",
    expected: "Establish baseline of LAN performance",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.1.3",
    check: "WAN Performance (recommended)",
    description: "Use iperf tool to measure Wide Area Network performance between Solace broker network segment at one data center  and another data center of Solace broker and/or client application network segment",
    requirement: "Establish baseline of WAN performance",
    source: "Use network iperf tool to test network throughput between two data centers network segments",
    expected: "Establish baseline of WAN performance",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2",
    check: "Broker Connectivity",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.1",
    check: "Management connectivity",
    description: "The Solace broker must be reachable over the management interface at SSH and HTTPS protocols from external servers on the network",
    requirement: "",
    source: "Software broker:\nOS:\nssh sysadmin@<solace-ip>\nCLI:\nssh -p 2222 <cli-admin>@<solace-ip>\n\nWeb browser or SolAdmin:\nhttps://<solace-fqdn>:1943\nUser: <cli-admin>",
    expected: "Succesfully login to CLI and WebUI",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.2",
    check: "File Transfer Connectivity",
    description: "File transfer users on the Solace broker must be able to log on and upload/download files",
    requirement: "",
    source: "Software broker:\nsftp -P 2222 <file-transfer-user>@<solace-ip>",
    expected: "Successfully login to FTP",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.3",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on plain-text port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcp://<ip-address>:55555 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.4",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on secure port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.5",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other> protocol",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.2.6",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol on secure port",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other>  protocol on secure port",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.3",
    check: "Messaging Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.3.1",
    check: "Direct Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -stl=<topicname>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.3.2",
    check: "Guaranteed Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000 -mt=persistent\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -sql=<queuename>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4",
    check: "Fault Tolerance",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.1",
    check: "Client HA failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing HA failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-node-ip-address>:55443,tcps:<backup-node-ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2000 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.2",
    check: "Graceful HA failovers",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Primary node is active. Backup node is standby",
    requirement: "",
    source: "Primary node:\nCLI/SEMP:\nenable\nconfigure\nredundancy release-activity\n(wait for approx 10 seconds and verify the redundancy status)\nshow redundancy\n(re-enable redundancy status)\nredundancy no release-activity",
    expected: "Primary Node:\nActivity Status: Mate Active",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.3",
    check: "Graceful HA failback",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Backup node:\nCLI/SEMP:\nenable\nadmin\nredundancy revert-activity\nshow redundancy",
    expected: "Backup Node:\nActivity Status: Mate Active",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.4",
    check: "Abrupt HA failovers",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Primary node is active. Backup Node is Standby",
    requirement: "",
    source: "Reboot Primary VM:\nOS:\nreboot\n\nVerify on backup node:\nshow redundancy\n",
    expected: "Backup Node:\nActivity Status: Local Active",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.5",
    check: "Abrupt HA failback",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Reboot Backup VM:\nOS:\nreboot\n\nVerify on primary node:\nshow redundancy\n",
    expected: "Primary Node:\nActivity Status: Local Active",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.6",
    check: "Client DR failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing DR failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription\n<topicname> is added in VPN replication replicated topic with SYNC mode",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-site-primary-ip>:55443,tcps:<primary-site-backup-ip>:55443,tcps:<dr-site-primary-ip>:55443,tcps:<dr-site-backup-ip>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2048 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.7",
    check: "DR failovers",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. Primary site VPN is active. DR site VPN is standby",
    requirement: "",
    source: "Primary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\n\nwait for 1 minute\n\nDR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active",
    expected: "Primary site VPN:\nLocal Status: Standby\n\nDR site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.4.8",
    check: "DR failback",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. DR site VPN is active. Primary site VPN is standby",
    requirement: "",
    source: "DR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\nshow message-vpn <name>\n\nwait for 1 minute\n\nPrimary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active\nshow message-vpn <name>\nshow replication",
    expected: "DR site VPN:\nLocal Status: Standby\n\nPrimary site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.5",
    check: "Monitoring Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.5.1",
    check: "Monitoring Tool Integration",
    description: "The monitoring solution for Solace ( Syslog/SEMP)) must be fully tested against the monitoring use cases to ensure the monitoring solution operates as expected and meets requirements",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.5.2",
    check: "Monitoring Host Connectivity",
    description: "Any monitoring hosts must be able to retrieve data from the Solace appliance via CLI/SEMP",
    requirement: "",
    source: "Verify Metrics Monitoring server can connect and collect metrics from management IP",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.5.3",
    check: "Alerting",
    description: "Verify that the correct monitoring alert recipients are configured and they receive the corresponding alerts",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.6",
    check: "Application Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.6.1",
    check: "Application connectivity",
    description: "Validate application connectivity",
    requirement: "Client authentication is successful and no connection flapping",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "Client authentication is successful and no connection flapping",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.6.2",
    check: "End-to-end event flows",
    description: "Validate that the application can send/receive messages over the bridge link",
    requirement: "All clients can send and receive messages as designed",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "All clients can send and receive messages as designed",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.6.3",
    check: "Applications should withstand HA failover",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an HA failover - applications should automatically reconnect to the backup Solace broker on an HA failover",
    requirement: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    source: "While publishing and subscribing  messages, perform HA failover",
    expected: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.6.4",
    check: "DR Replication",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an DR (Site) failover as designed in DR activation procedure.",
    requirement: "Clients can send and receive messages at DR brokers",
    source: "Perform DR failover procedure",
    expected: "Validation at client application",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.7",
    check: "Support Readiness",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: [],
    hardcodedOutput: ""
  },
  {
    ref: "5.7.1",
    check: "Support Hotline",
    description: "New Solace customer should be familiar of product support contact methods",
    requirement: "Customer can contact support hotline and receive response within expected response time",
    source: "Simulate a hotline call",
    expected: "Customer can contact support hotline and receive response within expected response time",
    commands: [],
    hardcodedOutput: ""
  }
];

const brokers = new Map();
const brokerRowState = new Map();
let currentRows = buildRows();
let nextBrokerRowId = 0;

const brokerUploadRows = document.querySelector("#brokerUploadRows");
const addBrokerButton = document.querySelector("#addBrokerButton");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const rowCount = document.querySelector("#rowCount");
const statusNode = document.querySelector("#status");
const downloadButton = document.querySelector("#downloadButton");
const clearButton = document.querySelector("#clearButton");

function createUploadZone(rowId, kind, labelText, accept) {
  const label = document.createElement("label");
  label.className = "upload-zone";
  label.setAttribute("for", `${kind}-${rowId}`);

  const input = document.createElement("input");
  input.id = `${kind}-${rowId}`;
  input.type = "file";
  input.accept = accept;
  input.multiple = true;
  input.addEventListener("change", async (event) => {
    await handleUploadedFiles(input, Array.from(event.target.files || []), kind);
  });

  const icon = document.createElement("span");
  icon.className = "upload-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "+";

  const meta = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = labelText;
  const small = document.createElement("small");
  small.textContent = kind === "diagnostics"
    ? "Each unique broker hostname becomes its own output column."
    : "Used to populate the readiness checks from the broker config dump.";
  meta.append(strong, small);

  label.append(input, icon, meta);
  return label;
}

function addBrokerUploadRow() {
  if (!brokerUploadRows) return;

  const rowId = ++nextBrokerRowId;
  const row = document.createElement("div");
  row.className = "broker-upload-row";
  row.dataset.rowId = String(rowId);

  const header = document.createElement("div");
  header.className = "broker-upload-row-header";

  const title = document.createElement("span");
  title.textContent = `Broker ${rowId}`;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-row-button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    brokerRowState.delete(rowId);
    rebuildBrokersFromRowState();
  });

  header.append(title, removeButton);

  const grid = document.createElement("div");
  grid.className = "broker-upload-grid";
  grid.append(
    createUploadZone(rowId, "diagnostics", "Upload cli-diagnostics.txt", ".txt,text/plain"),
    createUploadZone(rowId, "config", "Upload current-config / config.cli", ".txt,.cli,text/plain,.config")
  );

  row.append(header, grid);
  brokerUploadRows.append(row);
}

renderRows(currentRows);

function getRowHostname(sourceName, file, text, existingState) {
  const fallback = file.name.replace(/\.[^.]+$/, "").trim() || `${sourceName}-broker`;

  if (sourceName === "config") {
    if (existingState?.hostname) return existingState.hostname;
    if (existingState?.diagnosticsText) {
      const diagnosticsHostname = extractHostname(existingState.diagnosticsText);
      if (diagnosticsHostname) return diagnosticsHostname;
    }
    return fallback;
  }

  return extractHostname(text) || fallback;
}

function rebuildBrokersFromRowState() {
  brokers.clear();

  for (const rowState of brokerRowState.values()) {
    const hostname = rowState.hostname || rowState.diagnosticsFileName?.replace(/\.[^.]+$/, "") || rowState.configFileName?.replace(/\.[^.]+$/, "") || `broker-${rowState.rowId || "unknown"}`;
    brokers.set(hostname, {
      hostname,
      fileName: rowState.configFileName || rowState.diagnosticsFileName || "uploaded-file",
      diagnosticsText: rowState.diagnosticsText || "",
      configText: rowState.configText || "",
      text: rowState.configText || rowState.diagnosticsText || "",
    });
  }

  currentRows = buildRows();
  renderRows(currentRows);
}

async function handleUploadedFiles(input, files, sourceName) {
  if (!files.length) return;

  const added = [];
  const skipped = [];
  const failed = [];
  const row = input.closest(".broker-upload-row");
  const rowId = row ? Number(row.dataset.rowId) : null;

  for (const file of files) {
    const text = await file.text();
    const state = rowId !== null ? (brokerRowState.get(rowId) || { rowId, hostname: "", diagnosticsText: "", configText: "", diagnosticsFileName: "", configFileName: "" }) : {
      rowId: Date.now(),
      hostname: "",
      diagnosticsText: "",
      configText: "",
      diagnosticsFileName: "",
      configFileName: "",
    };

    if (sourceName === "diagnostics") {
      state.diagnosticsText = text;
      state.diagnosticsFileName = file.name;
      state.hostname = getRowHostname(sourceName, file, text, state);
    } else {
      state.configText = text;
      state.configFileName = file.name;
      state.hostname = getRowHostname(sourceName, file, text, state);
    }

    if (rowId !== null) {
      brokerRowState.set(rowId, state);
    }

    if (!brokers.has(state.hostname)) {
      brokers.set(state.hostname, {
        hostname: state.hostname,
        fileName: file.name,
        diagnosticsText: sourceName === "diagnostics" ? text : state.diagnosticsText || "",
        configText: sourceName === "config" ? text : state.configText || "",
        text: sourceName === "config" ? text : state.diagnosticsText || text,
      });
      added.push(state.hostname);
    } else {
      skipped.push(state.hostname);
    }
  }

  rebuildBrokersFromRowState();

  const missing = countMissingSections(currentRows);
  downloadButton.disabled = brokers.size === 0;
  clearButton.disabled = brokers.size === 0;
  if (input && typeof input.value !== "undefined") {
    input.value = "";
  }

  if (failed.length || skipped.length || missing) {
    statusNode.classList.add("warn");
    statusNode.textContent = [
      added.length ? `Added ${added.join(", ")}.` : "",
      skipped.length ? `Skipped duplicate broker ${skipped.join(", ")}.` : "",
      failed.length ? `Could not identify hostname in ${failed.join(", ")}.` : "",
      missing ? `${missing} command section(s) are missing across uploaded brokers.` : "",
    ].filter(Boolean).join(" ");
  } else {
    statusNode.classList.remove("warn");
    statusNode.textContent = `Added ${added.join(", ")}. All requested CLI sections were found.`;
  }
}

addBrokerButton.addEventListener("click", () => {
  addBrokerUploadRow();
});

clearButton.addEventListener("click", () => {
  brokerRowState.clear();
  brokerUploadRows.innerHTML = "";
  brokers.clear();
  currentRows = buildRows();
  renderRows(currentRows);
  downloadButton.disabled = true;
  clearButton.disabled = true;
  statusNode.classList.remove("warn");
  statusNode.textContent = "Waiting for broker files.";
});

downloadButton.addEventListener("click", () => {
  const brokerList = [...brokers.values()];
  const rows = [
    [...BASE_HEADER_ROW_1.slice(0, 6), ...brokerList.map((broker) => broker.hostname)],
    [...BASE_HEADER_ROW_2.slice(0, 6), ...brokerList.map(() => "Actual Output / Value")],
    ...currentRows.map((row) => [
    row.ref,
    row.check,
    row.description,
    row.requirement,
    row.source,
    row.expected,
      ...brokerList.map((broker) => row.outputs[broker.hostname] || ""),
    ]),
  ];

  const blob = createXlsx(rows, "Readiness Checklist");
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "SolaceOpsReadinessChecklist-generated.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

function buildRows() {
  const brokerList = [...brokers.values()];
  return CHECKS.map((item) => {
    const outputs = {};
    const missingByBroker = [];

    for (const broker of brokerList) {
      const diagnosticsText = broker.diagnosticsText || "";
      const configText = broker.configText || "";
      const sections = item.commands.map((command) => extractCommandSection(diagnosticsText, command));
      const directOutput = item.commands.length ? sections.filter(Boolean).join("\n\n") : "";
      const fallbackOutput = configText ? fallbackParsedRowOutput(item.ref, configText) : "";
      const output = directOutput || fallbackOutput || item.hardcodedOutput || "";
      outputs[broker.hostname] = formatRowOutput(item.ref, output);

      if (!output && item.commands.length) {
        missingByBroker.push(broker.hostname);
      }
    }

    return {
      ...item,
      outputs,
      missingByBroker,
    };
  });
}

function extractHostname(text) {
  const section = extractCommandSection(text, "show hostname");
  const match = section.match(/^Hostname:\s*(.+)$/m);
  if (match?.[1]?.trim()) return match[1].trim();

  const routerMatch = text.match(/!\s*Router:\s*"([^"]+)"/m);
  if (routerMatch?.[1]?.trim()) return routerMatch[1].trim();

  const brokerNameMatch = text.match(/(?:^|\n)\s*router-name\s+"?([^\s\n]+)"?/i);
  if (brokerNameMatch?.[1]?.trim()) return brokerNameMatch[1].trim();

  const messageVpnMatch = text.match(/message-vpn\s+"([^"]+)"/m);
  if (messageVpnMatch?.[1]?.trim()) return messageVpnMatch[1].trim();

  return "";
}

function extractCommandSection(text, command) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const marker = `# CLI command: ${command}`;
  const commandPattern = new RegExp(`^${escapeRegExp(marker)}\\s*$`, "m");
  const match = normalized.match(commandPattern);
  if (!match || match.index === undefined) return "";
  const start = match.index;

  const next = normalized.indexOf("\n#################################################################\n# CLI command:", start + marker.length);
  const section = normalized.slice(start, next === -1 ? undefined : next);
  return section.trim();
}

function formatRowOutput(ref, output) {
  if (ref === "1.1.5") return summarizeVersion(output);
  if (ref === "1.1.6") return summarizeServiceTable(output);
  if (ref === "1.1.8") return summarizeScalingTier(output);
  if (ref === "1.2.2") return summarizeMessageSpoolConfig(output);
  if (ref === "1.2.3") return summarizeMessageSpoolState(output);
  if (ref === "1.2.4") return summarizeMessageSpoolDefragmentation(output);
  if (ref === "1.3.1") return summarizeRedundancy(output);
  if (ref === "1.3.2") return summarizeConfigSync(output);
  if (ref === "1.8.1") return summarizeServerCertificateConfig(output);
  if (ref === "1.8.2") return summarizeServerCertificateValidity(output);
  if (ref === "1.8.3") return summarizeCertificateAuthorities(output);
  if (ref === "1.8.4") return summarizeClientCertificateAuthorities(output);
  if (ref === "1.10.1") return summarizeComputeResources(output);
  return output;
}

function commandHeader(section) {
  const lines = section.split("\n");
  const headerEnd = lines.findIndex((line, index) => index > 0 && line.trim() === "");
  return headerEnd >= 0 ? lines.slice(0, headerEnd + 1) : [];
}

function lineBlock(section, startPredicate, stopPredicate) {
  const lines = section.split("\n");
  const start = lines.findIndex(startPredicate);
  if (start === -1) return [];

  const output = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > start && stopPredicate(line, index, lines)) break;
    output.push(line);
  }
  return output;
}

function keyLines(section, keys) {
  const wanted = new Set(keys);
  return section.split("\n").filter((line) => {
    const trimmed = line.trim();
    return [...wanted].some((key) => trimmed.startsWith(key));
  });
}

function summarizeVersion(section) {
  if (!section) return "";

  return [
    ...commandHeader(section),
    "",
    ...keyLines(section, ["Current load is:"]),
  ].join("\n").trim();
}

function summarizeServiceTable(section) {
  if (!section) return "";

  return lineBlock(
    section,
    (line) => line.startsWith("Service    TP"),
    (line) => line.trim() === "" || line.trim().startsWith("Flags Legend:")
  ).join("\n").trim();
}

function summarizeScalingTier(section) {
  if (!section) return "";

  const output = commandHeader(section);
  const lines = section.split("\n");
  const stopLine = "  Cores";

  for (const line of lines.slice(output.length)) {
    output.push(line);
    if (line.trim().startsWith(stopLine.trim())) break;
  }

  return output.join("\n").trim();
}

function summarizeMessageSpoolConfig(section) {
  if (!section) return "";

  return [
    ...commandHeader(section),
    "",
    ...keyLines(section, ["Config Status:", "Maximum Spool Usage:"]),
  ].join("\n").trim();
}

function summarizeMessageSpoolState(section) {
  if (!section) return "";

  const configLines = keyLines(section, ["Config Status:", "Maximum Spool Usage:", "Using Internal Disk:"]);
  const operationalLines = keyLines(section, ["Operational Status:"]);
  return [
    ...commandHeader(section),
    "",
    ...configLines,
    "",
    ...operationalLines,
  ].join("\n").trim();
}

function summarizeMessageSpoolDefragmentation(section) {
  if (!section) return "";

  return lineBlock(
    section,
    (line) => line.trim() === "Defragmentation:",
    (line) => line.trim().startsWith("Last Result:")
  ).join("\n").trim();
}

function summarizeRedundancy(section) {
  if (!section) return "";

  return [
    ...commandHeader(section),
    ...keyLines(section, ["Configuration Status", "Redundancy Status"]),
  ].join("\n").trim();
}

function summarizeConfigSync(section) {
  if (!section) return "";

  return [
    ...commandHeader(section),
    "",
    ...keyLines(section, ["Admin Status", "Oper Status", "SSL Enabled"]),
  ].join("\n").trim();
}

function summarizeComputeResources(section) {
  if (!section) return "";

  const output = commandHeader(section);
  const resourceBlock = lineBlock(
    section,
    (line) => /^System Resource\s+Available\s+Required\s+Units/.test(line),
    (line) => line.trim().startsWith("contains:")
  );
  return [...output, ...resourceBlock].join("\n").trim();
}

function summarizeServerCertificateConfig(section) {
  if (!section) return "";

  const output = commandHeader(section);
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Filename:") || trimmed.startsWith("Configured at:")) {
      output.push(line);
    }
  }

  return output.join("\n").trim();
}

function summarizeServerCertificateValidity(section) {
  if (!section) return "";

  const output = ["YES"];
  const lines = section.split("\n");
  const validityIndex = lines.findIndex((line) => line.trim() === "Validity");
  if (validityIndex === -1) return output.join("\n");

  output.push("", "Validity");
  for (let index = validityIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("Not Before:") || trimmed.startsWith("Not After :")) {
      output.push(line);
    } else if (trimmed && !trimmed.startsWith("Not ")) {
      break;
    }
  }

  return output.join("\n").trim();
}

function summarizeCertificateAuthorities(section) {
  if (!section) return "";

  const lines = section.split("\n");
  const output = commandHeader(section);
  let certificateCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("Certificate Authority:")) continue;

    if (certificateCount > 0) output.push("", "---------");
    if (output.length && output[output.length - 1] !== "") output.push("");
    output.push(line);
    certificateCount += 1;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];
      if (current.trim().startsWith("Certificate Authority:")) break;
      if (current.trim() === "Validity") {
        output.push("");
        output.push("Validity");
        for (let validityCursor = cursor + 1; validityCursor < lines.length; validityCursor += 1) {
          const validityLine = lines[validityCursor];
          const trimmed = validityLine.trim();
          if (trimmed.startsWith("Not Before:") || trimmed.startsWith("Not After :")) {
            output.push(validityLine);
          } else if (trimmed && !trimmed.startsWith("Not ")) {
            break;
          }
        }
        break;
      }
    }
  }

  return output.join("\n").trim();
}

function summarizeClientCertificateAuthorities(section) {
  if (!section) return "";

  const output = commandHeader(section);
  for (const line of section.split("\n")) {
    if (line.trim().startsWith("Client Certificate Authority:")) {
      output.push(line);
      break;
    }
  }

  return output.join("\n").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMissingSections(rows) {
  return rows.reduce((total, row) => total + row.missingByBroker.length, 0);
}

function fallbackParsedRowOutput(ref, text) {
  if (!text) return "";

  const parsed = parseCurrentConfigFacts(text);

  switch (ref) {
    case "1.4.1":
      return parsed.ldapProfileSummary || "";
    case "1.4.2":
      return parsed.oauthSummary || "";
    case "1.5.1":
      return parsed.usernameSummary || "";
    case "1.5.2":
      return parsed.defaultAccessSummary || "";
    case "1.5.3":
      return parsed.authTypeSummary || "";
    case "1.5.4":
      return parsed.ldapAuthSummary || "";
    case "1.5.5":
      return parsed.oauthAccessSummary || "";
    case "1.6.2":
      return parsed.syslogSummary || "";
    case "1.7.1":
      return parsed.backupSummary || "";
    case "1.7.2":
      return parsed.backupArchiveSummary || "";
    case "1.9.1":
      return parsed.replicationSummary || "";
    case "1.9.2":
      return parsed.configSyncBridgeSummary || "";
    case "2.1.2":
      return parsed.vpnAuthSummary || "";
    case "2.1.3":
      return parsed.vpnLimitSummary || "";
    case "2.1.4":
      return parsed.vpnServiceSummary || "";
    case "2.1.5":
      return parsed.clientProfileSummary || "";
    case "2.1.6":
      return parsed.aclProfileNamesSummary || "";
    case "2.1.7":
      return parsed.clientUsernameSummary || "";
    case "2.1.8":
      return parsed.queueSummary || "";
    case "2.1.9":
      return parsed.topicSummary || "";
    case "2.2.1":
      return parsed.bridgeSummary || "";
    case "2.2.2":
      return parsed.bridgeSubscriptionSummary || "";
    case "2.2.3":
      return parsed.bridgeKeepaliveSummary || "";
    case "2.2.4":
      return parsed.bridgeTuningSummary || "";
    case "2.3.1":
      return parsed.replicationBridgeSummary || "";
    case "2.3.2":
      return "";
    case "2.3.3":
      return parsed.replicationKeepaliveSummary || "";
    case "2.3.4":
      return parsed.replicationTuningSummary || "";
    case "4.1.2":
      return parsed.defaultVpnSummary || "";
    case "4.1.3":
      return parsed.defaultClientUsernameSummary || "";
    case "4.1.4":
      return parsed.clientUsernameSummary || "";
    case "4.1.5":
      return parsed.clientCertificateSummary || "";
    case "4.2.1":
      return parsed.aclProfileSummary || "";
    case "4.2.2":
      return parsed.aclProfileSummary || "";
    case "4.2.3":
      return parsed.aclProfileSummary || "";
    case "4.2.4":
      return parsed.clientProfileSummary || "";
    case "4.3.1":
      return parsed.defaultAccessSummary || "";
    case "4.4.1":
      return parsed.bridgeTlsSummary || "";
    case "4.4.2":
      return parsed.managementHttpsSummary || "";
    case "4.4.3":
      return parsed.clientTlsSummary || "";
    case "4.4.4":
      return parsed.tlsDowngradeSummary || "";
    case "4.4.5":
      return parsed.tlsVersionSummary || "";
    case "4.4.6":
      return parsed.certificateAlgorithmSummary || "";
    case "4.4.7":
      return parsed.cipherSuiteSummary || "";
    default:
      return "";
  }
}

function parseCurrentConfigFacts(text) {
  const lines = (text || "").replace(/\r\n?/g, "\n").split("\n");
  const usernameList = [];
  const clientUsernameList = [];
  const clientUsernameStatus = {};
  const ldapProfiles = {};
  const vpnAuth = {};
  const cipherSuites = {};
  const vpnDetails = {};
  const queues = [];
  const subscriptions = [];
  const aclProfiles = [];
  const clientProfiles = [];
  const bridgeFacts = [];
  const replicationFacts = [];
  let currentVpn = null;
  let currentLdapProfile = null;
  let currentAuthSection = null;
  let currentClientUsername = null;
  let currentClientProfile = null;
  let currentAclProfile = null;
  let defaultAccessLevel = "unknown";
  let authType = "unknown";
  let oauthDefaultProfile = "";
  let oauthGroups = [];
  let ldapMembershipAttribute = "";
  let syslogForwarding = "not configured";
  let backupSchedule = "not configured";
  let backupArchive = "not configured";
  let tlsVersionEnabled = "unknown";
  let tlsDowngrade = "unknown";
  let certificateAlgorithm = "not explicit";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const createUsernameMatch = /^create username\s+"([^"]+)"/.exec(trimmed);
    if (createUsernameMatch) {
      usernameList.push(createUsernameMatch[1]);
      continue;
    }

    const createClientUsernameMatch = /^create client-username\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(trimmed);
    if (createClientUsernameMatch) {
      const [, name, vpnName] = createClientUsernameMatch;
      clientUsernameList.push(`${name} (${vpnName})`);
      currentClientUsername = name;
      clientUsernameStatus[name] = { vpn: vpnName, enabled: true };
      continue;
    }

    const defaultClientUsernameMatch = /^client-username\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(trimmed);
    if (defaultClientUsernameMatch) {
      const [, name, vpnName] = defaultClientUsernameMatch;
      clientUsernameList.push(`${name} (${vpnName})`);
      currentClientUsername = name;
      clientUsernameStatus[name] = { vpn: vpnName, enabled: true };
      continue;
    }

    if (currentClientUsername && /^\s*no shutdown\s*$/.test(trimmed)) {
      clientUsernameStatus[currentClientUsername].enabled = true;
      continue;
    }

    if (currentClientUsername && /^\s*shutdown\s*$/.test(trimmed)) {
      clientUsernameStatus[currentClientUsername].enabled = false;
      continue;
    }

    const aclProfileMatch = /^acl-profile\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(trimmed);
    if (aclProfileMatch) {
      const [, aclName, vpnName] = aclProfileMatch;
      currentAclProfile = aclName;
      aclProfiles.push({ name: aclName, vpn: vpnName, rules: [] });
      continue;
    }

    if (currentAclProfile && /^\s*(client-connect|publish-topic|subscribe-topic|subscribe-share-name)\s+default-action\s+"([^"]+)"/.test(trimmed)) {
      const match = /^\s*(client-connect|publish-topic|subscribe-topic|subscribe-share-name)\s+default-action\s+"([^"]+)"/.exec(trimmed);
      if (match) {
        const [, key, value] = match;
        const profile = aclProfiles[aclProfiles.length - 1];
        profile.rules.push(`${key}: ${value}`);
      }
      continue;
    }

    const clientProfileMatch = /^client-profile\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(trimmed);
    if (clientProfileMatch) {
      const [, name, vpnName] = clientProfileMatch;
      currentClientProfile = name;
      clientProfiles.push({ name, vpn: vpnName, flags: [] });
      continue;
    }

    if (currentClientProfile && /^\s*(allow-bridge-connections|allow-shared-subscriptions|no allow-shared-subscriptions|no compression shutdown|ssl allow-downgrade-to-plain-text|no ssl allow-downgrade-to-plain-text|message-spool allow-guaranteed-endpoint-create|message-spool allow-guaranteed-message-send|message-spool allow-guaranteed-message-receive)/.test(trimmed)) {
      clientProfiles[clientProfiles.length - 1].flags.push(trimmed.trim());
      continue;
    }

    const vpnMatch = /^message-vpn\s+"([^"]+)"$/.exec(trimmed);
    if (vpnMatch) {
      currentVpn = vpnMatch[1];
      vpnDetails[currentVpn] = {
        maxConnections: "",
        maxSubscriptions: "",
        maxSpoolUsage: "",
        services: [],
      };
      vpnAuth[currentVpn] = {
        basicAuthType: "",
        basicProfile: "",
        oauthEnabled: "",
        oauthDefaultProfile: "",
        clientCertificateEnabled: "",
        authType: "",
      };
      continue;
    }

    if (currentVpn && /^\s*max-connections\s+(\d+)/.test(trimmed)) {
      vpnDetails[currentVpn].maxConnections = /^\s*max-connections\s+(\d+)/.exec(trimmed)[1];
      continue;
    }

    if (currentVpn && /^\s*max-subscriptions\s+(\d+)/.test(trimmed)) {
      vpnDetails[currentVpn].maxSubscriptions = /^\s*max-subscriptions\s+(\d+)/.exec(trimmed)[1];
      continue;
    }

    if (currentVpn && /^\s*max-spool-usage\s+(\d+)/.test(trimmed)) {
      vpnDetails[currentVpn].maxSpoolUsage = /^\s*max-spool-usage\s+(\d+)/.exec(trimmed)[1];
      continue;
    }

    if (currentVpn && /^\s*service\s+([\w-]+)\s+(?:listen-port\s+.*|max-connections\s+\d+|authentication\s+.*)/.test(trimmed)) {
      vpnDetails[currentVpn].services.push(trimmed.trim());
      continue;
    }

    if (currentVpn && /^\s*basic auth-type\s+(.+)$/.test(trimmed)) {
      vpnAuth[currentVpn].basicAuthType = /^\s*basic auth-type\s+(.+)$/.exec(trimmed)[1].trim();
      continue;
    }

    if (currentVpn && /^\s*basic.*auth-profile\s+"?([^"\s]+)"?/.test(trimmed)) {
      vpnAuth[currentVpn].basicProfile = /^\s*basic.*auth-profile\s+"?([^"\s]+)"?/.exec(trimmed)[1].trim();
      continue;
    }

    if (currentVpn && /^\s*oauth default-profile\s+"?([^"\s]*)"?$/.test(trimmed)) {
      vpnAuth[currentVpn].oauthDefaultProfile = /^\s*oauth default-profile\s+"?([^"\s]*)"?$/.exec(trimmed)[1].trim();
      continue;
    }

    if (currentVpn && /^\s*oauth shutdown$/.test(trimmed)) {
      vpnAuth[currentVpn].oauthEnabled = "No";
      continue;
    }

    if (currentVpn && /^\s*no oauth shutdown$/.test(trimmed)) {
      vpnAuth[currentVpn].oauthEnabled = "Yes";
      continue;
    }

    if (currentVpn && /^\s*client-certificate$/.test(trimmed)) {
      currentAuthSection = "client-certificate";
      continue;
    }

    if (currentVpn && currentAuthSection === "client-certificate" && /^\s*shutdown$/.test(trimmed)) {
      vpnAuth[currentVpn].clientCertificateEnabled = "Disabled";
      currentAuthSection = null;
      continue;
    }

    if (currentVpn && currentAuthSection === "client-certificate" && /^\s*no shutdown$/.test(trimmed)) {
      vpnAuth[currentVpn].clientCertificateEnabled = "Enabled";
      currentAuthSection = null;
      continue;
    }

    if (currentVpn && /^\s*authorization-type\s+(.+)$/.test(trimmed)) {
      vpnAuth[currentVpn].authType = /^\s*authorization-type\s+(.+)$/.exec(trimmed)[1].trim();
      continue;
    }

    const queueMatch = /^\s*create queue\s+"([^"]+)"/.exec(trimmed);
    if (queueMatch) {
      queues.push(queueMatch[1]);
      continue;
    }

    const subscriptionMatch = /^\s*subscription topic\s+"([^"]+)"/.exec(trimmed);
    if (subscriptionMatch) {
      subscriptions.push(subscriptionMatch[1]);
      continue;
    }

    const bridgeMatch = /^\s*(?:bridge|replication)\s+.*(?:window-size|retry-delay|ssl|authentication|client-profile|message-spool|unidirectional|bidirectional)/.exec(trimmed);
    if (bridgeMatch) {
      bridgeFacts.push(trimmed.trim());
      continue;
    }

    if (/^\s*replication\s+ssl\s+/.test(trimmed) || /^\s*replication config-sync bridge/.test(trimmed) || /^\s*replication\s+config-sync/.test(trimmed)) {
      replicationFacts.push(trimmed.trim());
      continue;
    }

    const ldapProfileMatch = /^ldap-profile\s+"([^"]+)"/.exec(trimmed);
    if (ldapProfileMatch) {
      currentLdapProfile = ldapProfileMatch[1];
      ldapProfiles[currentLdapProfile] = {
        adminDn: "",
        baseDn: "",
        tlsEnabled: null,
        enabled: null,
        ldapServers: [],
      };
      continue;
    }

    if (currentLdapProfile && /^\s*shutdown$/.test(trimmed)) {
      ldapProfiles[currentLdapProfile].enabled = false;
      continue;
    }

    if (currentLdapProfile && /^\s*no shutdown$/.test(trimmed)) {
      ldapProfiles[currentLdapProfile].enabled = true;
      continue;
    }

    if (currentLdapProfile && /^\s*starttls$/.test(trimmed)) {
      ldapProfiles[currentLdapProfile].tlsEnabled = true;
      continue;
    }

    if (currentLdapProfile && /^\s*no starttls$/.test(trimmed)) {
      ldapProfiles[currentLdapProfile].tlsEnabled = false;
      continue;
    }

    const adminDnMatch = /^\s*admin dn\s+"?([^"\n]+)"?/.exec(trimmed);
    if (currentLdapProfile && adminDnMatch) {
      ldapProfiles[currentLdapProfile].adminDn = adminDnMatch[1].trim();
      continue;
    }

    const baseDnMatch = /^\s*search base-dn\s+"?([^"\n]+)"?/.exec(trimmed);
    if (currentLdapProfile && baseDnMatch) {
      ldapProfiles[currentLdapProfile].baseDn = baseDnMatch[1].trim();
      continue;
    }

    const ldapServerMatch = /^\s*ldap-server index\s+(\d+)/.exec(trimmed);
    if (currentLdapProfile && ldapServerMatch) {
      ldapProfiles[currentLdapProfile].ldapServers.push(ldapServerMatch[1]);
      continue;
    }

    const authTypeMatch = /^\s*auth-type\s+(.+)$/.exec(trimmed);
    if (authTypeMatch) {
      authType = authTypeMatch[1].trim();
      continue;
    }

    const defaultAccessMatch = /^\s*global-access-level\s+"([^"]+)"/.exec(trimmed);
    if (defaultAccessMatch) {
      defaultAccessLevel = defaultAccessMatch[1].trim();
      continue;
    }

    const oauthDefaultMatch = /^\s*oauth-profile-default\s+"([^"]*)"/.exec(trimmed);
    if (oauthDefaultMatch) {
      oauthDefaultProfile = oauthDefaultMatch[1].trim();
      continue;
    }

    const ldapGroupAttrMatch = /^\s*ldap\s+group-membership-attribute-name\s+"([^"]+)"/.exec(trimmed);
    if (ldapGroupAttrMatch) {
      ldapMembershipAttribute = ldapGroupAttrMatch[1].trim();
      continue;
    }

    if (/^\s*logging\s+/.test(trimmed) || /^\s*syslog\s+/.test(trimmed)) {
      syslogForwarding = trimmed;
      continue;
    }

    if (/^\s*no schedule backup\s*$/.test(trimmed)) {
      backupSchedule = "disabled";
      continue;
    }

    if (/^\s*schedule backup\s*/.test(trimmed)) {
      backupSchedule = trimmed;
      continue;
    }

    if (/^\s*no\s+service\s+.*ssl|^\s*service\s+.*listen-port.*ssl/.test(trimmed)) {
      if (/\bweb-transport\b|\bsemp\b|\bmqtt\b|\bamqp\b|\brest\b/.test(trimmed)) {
        if (/listen-port\s+\d+\s+ssl|listen-port\s+\d+\s+"ssl"|listen-port\s+\d+\s+"ssl"|listen-port\s+\d+\s+ssl/.test(trimmed)) {
          // intentionally no-op, used to keep secure port detection in a later summary
        }
      }
    }

    if (/^\s*no ssl allow-downgrade-to-plain-text\s*$/.test(trimmed)) {
      tlsDowngrade = "disabled";
      continue;
    }

    if (/^\s*ssl allow-downgrade-to-plain-text\s*$/.test(trimmed)) {
      tlsDowngrade = "enabled";
      continue;
    }

    if (/^\s*no ssl allow-tls-version-1\.1\s*$/.test(trimmed)) {
      tlsVersionEnabled = "1.2+";
      continue;
    }

    if (/^\s*ssl allow-tls-version-1\.1\s*$/.test(trimmed)) {
      tlsVersionEnabled = "1.1 enabled";
      continue;
    }

    const certAlgoMatch = /^\s*signature algorithm\s+(.+)$/i.exec(trimmed);
    if (certAlgoMatch) {
      certificateAlgorithm = certAlgoMatch[1].trim();
      continue;
    }

    if (/^\s*ssl cipher-suite\s+(management|msg-backbone|ssh)\s+(.+)$/.test(trimmed)) {
      const match = /^\s*ssl cipher-suite\s+(management|msg-backbone|ssh)\s+(.+)$/.exec(trimmed);
      cipherSuites[match[1]] = match[2].trim();
      continue;
    }

    if (/^!\s*Create LDAP Profile:/.test(trimmed)) {
      currentLdapProfile = null;
    }
  }

  const ldapSummary = Object.entries(ldapProfiles).map(([profileName, values]) => {
    const lines = [`${profileName}:`];
    if (values.adminDn) lines.push(`Admin DN: ${values.adminDn}`);
    lines.push(`STARTTLS: ${values.tlsEnabled === null ? "Unknown" : values.tlsEnabled ? "Yes" : "No"}`);
    if (values.baseDn) lines.push(`Base DN: ${values.baseDn}`);
    if (values.ldapServers.length) lines.push(`LDAP Server Index #: ${values.ldapServers.join(", ")}`);
    return lines.join("\n");
  }).join("\n\n");

  const vpnSummary = Object.entries(vpnAuth).map(([vpnName, values]) => {
    const oauthEnabled = values.oauthEnabled || (values.oauthDefaultProfile ? "Yes" : "No");
    const clientCertState = values.clientCertificateEnabled || "Unknown";
    return [
      `${vpnName}:`,
      "BASIC:",
      `Basic Authentication: ${values.basicAuthType ? "Enabled" : "Disabled"}`,
      `Auth Type: ${values.basicAuthType || "internal"}`,
      `Auth Profile: ${values.basicProfile || ""}`,
      "",
      "CLIENT CERTIFICATE:",
      `Client Certificate Authentication: ${clientCertState}`,
      "",
      "OAUTH:",
      `Oauth Authentication Enabled: ${oauthEnabled}`,
      `Default Profile Name: ${values.oauthDefaultProfile || ""}`,
      "",
      "AUTHORIZATION TYPE:",
      `Authorization Type: ${values.authType || "Internal"}`,
    ].filter((line) => line !== null).join("\n");
  }).join("\n\n");

  const defaultAccessSummary = `Default Global Access: ${defaultAccessLevel}\nAuth Type: ${authType}`;
  const oauthSummary = `Default OAuth profile: ${oauthDefaultProfile || "not configured"}`;
  const authTypeSummary = `CLI auth-type: ${authType}`;
  const ldapAuthSummary = ldapMembershipAttribute ? `LDAP group membership attribute: ${ldapMembershipAttribute}` : "LDAP groups: not configured";
  const oauthAccessSummary = oauthDefaultProfile ? `OAuth default profile: ${oauthDefaultProfile}` : "OAuth authorization groups: not configured";
  const syslogSummary = `Syslog forwarding: ${syslogForwarding}`;
  const backupSummary = `Backup schedule: ${backupSchedule}`;
  const backupArchiveSummary = `Backup archival: ${backupArchive}`;
  const replicationSummary = replicationFacts.length ? replicationFacts.join("\n") : "Replication: not configured";
  const configSyncBridgeSummary = replicationFacts.length ? replicationFacts.filter((line) => /config-sync/i.test(line)).join("\n") || "Config-sync bridge: not configured" : "Config-sync bridge: not configured";
  const vpnLimitSummary = Object.entries(vpnDetails).map(([vpnName, values]) => {
    return [vpnName, values.maxConnections ? `Max Connections: ${values.maxConnections}` : "", values.maxSubscriptions ? `Max Subscriptions: ${values.maxSubscriptions}` : "", values.maxSpoolUsage ? `Max Spool Usage: ${values.maxSpoolUsage}` : ""].filter(Boolean).join("\n");
  }).join("\n\n") || "VPN limits: not configured";
  const vpnServiceSummary = Object.entries(vpnDetails).map(([vpnName, values]) => `${vpnName}:\n${values.services.join("\n") || "No VPN service definitions found"}`).join("\n\n") || "VPN services: not configured";
  const clientProfileSummary = clientProfiles.length ? clientProfiles.map((profile) => `${profile.name} (${profile.vpn}):\n${profile.flags.join("\n") || "No flags"}`).join("\n\n") : "Client profiles: not configured";
  const aclProfileSummary = aclProfiles.length ? aclProfiles.map((profile) => `${profile.name} (${profile.vpn}):\n${profile.rules.join("\n") || "No ACL rules"}`).join("\n\n") : "ACL profiles: not configured";
  const queueSummary = queues.length ? queues.join("\n") : "Queues: not configured";
  const topicSummary = subscriptions.length ? subscriptions.join("\n") : "Queue subscriptions: not configured";
  const bridgeSummary = bridgeFacts.length ? bridgeFacts.join("\n") : "Bridge: not configured";
  const bridgeSubscriptionSummary = subscriptions.length ? subscriptions.slice(0, 10).join("\n") : "Bridge subscriptions: not configured";
  const bridgeKeepaliveSummary = bridgeFacts.filter((line) => /keepalive|idle|interval|count/i.test(line)).join("\n") || "Bridge keepalive: not configured";
  const bridgeTuningSummary = bridgeFacts.filter((line) => /window-size|max-depth|min-msg-burst|burst|priority/i.test(line)).join("\n") || "Bridge WAN tuning: not configured";
  const replicationBridgeSummary = replicationFacts.length ? replicationFacts.join("\n") : "Replication bridge: not configured";
  const replicationTopicSummary = subscriptions.length ? subscriptions.join("\n") : "Replication subscriptions: not configured";
  const replicationKeepaliveSummary = bridgeFacts.filter((line) => /keepalive|idle|interval|count/i.test(line)).join("\n") || "Replication keepalive: not configured";
  const replicationTuningSummary = bridgeFacts.filter((line) => /window-size|max-depth|min-msg-burst|burst|priority/i.test(line)).join("\n") || "Replication WAN tuning: not configured";
  const defaultVpnSummary = (() => {
    const lines = (text || "").replace(/\r\n?/g, "\n").split("\n");
    let foundEnableBlock = false;
    let insideDefaultVpn = false;
    let state = "Unknown";

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^!\s*Enable Message Vpn:\s*"default"\s*$/i.test(trimmed)) {
        foundEnableBlock = true;
        insideDefaultVpn = false;
        continue;
      }

      if (!foundEnableBlock) continue;

      if (/^!\s*.*$/.test(trimmed) && !/^!\s*Enable Message Vpn:\s*"default"\s*$/i.test(trimmed)) {
        break;
      }

      if (/^message-vpn\s+"default"\s*$/i.test(trimmed)) {
        insideDefaultVpn = true;
        continue;
      }

      if (insideDefaultVpn && /^\s*exit\s*$/.test(line)) {
        insideDefaultVpn = false;
        continue;
      }

      if (insideDefaultVpn && /^\s{2}(no shutdown|shutdown)\s*$/.test(line)) {
        state = line.trim() === "shutdown" ? "Disabled" : "Enabled";
        break;
      }
    }

    return `Message VPN: default\nConfiguration Status: ${state}`;
  })();

  const defaultClientUsernameBlocks = [];
  const defaultClientUsernameLines = (text || "").replace(/\r\n?/g, "\n").split("\n");
  let currentDefaultClientUsernameBlock = null;

  for (const line of defaultClientUsernameLines) {
    const trimmed = line.trim();

    if (/^!\s*Create Client Username:\s*"default"\s*$/.test(trimmed)) {
      if (currentDefaultClientUsernameBlock !== null) {
        defaultClientUsernameBlocks.push(currentDefaultClientUsernameBlock);
      }
      currentDefaultClientUsernameBlock = [];
      continue;
    }

    if (currentDefaultClientUsernameBlock !== null && (/^!\s*Create Client Username:\s*".*"\s*$/.test(trimmed) || /^!\s*END\s*$/.test(trimmed))) {
      defaultClientUsernameBlocks.push(currentDefaultClientUsernameBlock);
      currentDefaultClientUsernameBlock = null;
      if (/^!\s*Create Client Username:\s*"default"\s*$/.test(trimmed)) {
        currentDefaultClientUsernameBlock = [];
      }
      continue;
    }

    if (currentDefaultClientUsernameBlock !== null) {
      currentDefaultClientUsernameBlock.push(line);
    }
  }

  if (currentDefaultClientUsernameBlock !== null) {
    defaultClientUsernameBlocks.push(currentDefaultClientUsernameBlock);
  }

  const defaultClientUsernameSummary = defaultClientUsernameBlocks
    .map((block) => {
      const blockText = block.join("\n");
      const vpnMatch = blockText.match(/client-username\s+"default"\s+message-vpn\s+"([^"]+)"/i) || blockText.match(/message-vpn\s+"([^"]+)"/i);
      const vpnName = vpnMatch?.[1]?.trim() || "unknown";
      const statusMatch = blockText.match(/(^|\n)\s*(no shutdown|shutdown)\s*(?:\n|$)/m);
      const state = statusMatch ? (statusMatch[2].startsWith("no ") ? "enabled" : "disabled") : "unknown";
      return `message-vpn:${vpnName}/${state}`;
    })
    .filter((item) => !/message-vpn:unknown\/unknown/.test(item))
    .join("\n") || "message-vpn:default/not found";

  const clientCertificateSummary = Object.entries(vpnAuth).map(([vpnName, values]) => `${vpnName}: client certificate ${values.clientCertificateEnabled || "unknown"}`).join("\n") || "Client certificate auth: not configured";
  const managementHttpsSummary = `Management HTTPS: ${/service web-transport listen-port .*ssl|no service web-transport shutdown/.test(text) ? "enabled" : "not configured"}\nWeb-manager redirect: ${/web-manager redirect-http/.test(text) ? "configured" : "not configured"}`;
  const clientTlsSummary = `Client TLS ports: ${lines.filter((line) => /listen-port\s+\d+\s+ssl/.test(line)).slice(0, 10).join("; ") || "none"}`;
  const tlsDowngradeSummary = `TLS downgrade to plaintext: ${tlsDowngrade}`;
  const tlsVersionSummary = `Allowed TLS versions: ${tlsVersionEnabled}`;
  const certificateAlgorithmSummary = `Signature algorithm: ${certificateAlgorithm}`;
  const cipherSuiteSummary = Object.entries(cipherSuites).map(([name, value]) => `${name}: ${value}`).join("\n") || "Cipher suites: not configured";

  return {
    usernameSummary: usernameList.length ? usernameList.map((name, index) => `${index + 1}: ${name}`).join("\n") : "",
    clientUsernameSummary: clientUsernameList.length ? clientUsernameList.join("\n") : "Client usernames: not configured",
    defaultClientUsernameSummary,
    oauthSummary,
    defaultAccessSummary,
    authTypeSummary,
    ldapAuthSummary,
    oauthAccessSummary,
    syslogSummary,
    backupSummary,
    backupArchiveSummary,
    replicationSummary,
    configSyncBridgeSummary,
    ldapProfileSummary: ldapSummary,
    vpnAuthSummary: vpnSummary,
    vpnLimitSummary,
    vpnServiceSummary,
    clientProfileSummary,
    aclProfileSummary,
    aclProfileNamesSummary: aclProfiles.length ? aclProfiles.map((profile) => profile.name).join("\n") : "",
    queueSummary,
    topicSummary,
    bridgeSummary,
    bridgeSubscriptionSummary,
    bridgeKeepaliveSummary,
    bridgeTuningSummary,
    replicationBridgeSummary,
    replicationTopicSummary,
    replicationKeepaliveSummary,
    replicationTuningSummary,
    defaultVpnSummary,
    clientCertificateSummary,
    bridgeTlsSummary: bridgeFacts.length ? bridgeFacts.join("\n") : "Bridge TLS: not configured",
    managementHttpsSummary,
    clientTlsSummary,
    tlsDowngradeSummary,
    tlsVersionSummary,
    certificateAlgorithmSummary,
    cipherSuiteSummary,
  };
}

function renderRows(rows) {
  renderHeader();
  tableBody.innerHTML = "";
  const brokerList = [...brokers.values()];
  rowCount.textContent = `${rows.length} rows, ${brokerList.length} broker${brokerList.length === 1 ? "" : "s"}`;

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = rowClass(row);
    const values = [
      row.ref,
      row.check,
      row.description,
      row.requirement,
      row.source,
      row.expected,
      ...brokerList.map((broker) => row.outputs[broker.hostname] || ""),
    ];

    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (index >= 4) td.className = "pre";
      td.textContent = value || "";
      const broker = brokerList[index - 6];
      if (broker && row.missingByBroker.includes(broker.hostname)) {
        td.classList.add("missing");
        td.textContent = `Missing command section: ${row.commands.join(", ")}`;
      }
      tr.append(td);
    });

    tableBody.append(tr);
  }
}

function renderHeader() {
  tableHead.innerHTML = "";
  const brokerList = [...brokers.values()];
  const row1 = document.createElement("tr");
  const row2 = document.createElement("tr");

  for (const label of BASE_HEADER_ROW_1.slice(0, 4)) {
    const th = document.createElement("th");
    th.textContent = label;
    th.rowSpan = 2;
    row1.append(th);
  }

  const softwareHeader = document.createElement("th");
  softwareHeader.textContent = "Software Broker";
  softwareHeader.colSpan = 2;
  row1.append(softwareHeader);

  for (const label of BASE_HEADER_ROW_2.slice(4, 6)) {
    const th = document.createElement("th");
    th.textContent = label;
    row2.append(th);
  }

  const visibleBrokers = brokerList.length ? brokerList : [{ hostname: "" }];
  for (const broker of visibleBrokers) {
    const brokerTh = document.createElement("th");
    brokerTh.textContent = broker.hostname;
    row1.append(brokerTh);

    const outputTh = document.createElement("th");
    outputTh.textContent = "Actual Output / Value";
    row2.append(outputTh);
  }

  tableHead.append(row1, row2);
}

function rowClass(row) {
  if (/^\d+$/.test(row.ref)) return "group-row";
  if (/^\d+\.\d+$/.test(row.ref)) return "section-row";
  return "";
}

function createXlsx(rows, sheetName) {
  const files = {
    "[Content_Types].xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    "_rels/.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/app.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Solace Readiness Checklist Builder</Application>
</Properties>`),
    "docProps/core.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Solace Ops Readiness Checklist</dc:title>
  <dc:creator>Solace Readiness Checklist Builder</dc:creator>
  <cp:lastModifiedBy>Solace Readiness Checklist Builder</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`),
    "xl/workbook.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font></fonts>
  <fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFA4A7AA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDF2D1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center" horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    "xl/worksheets/sheet1.xml": xml(createWorksheetXml(rows)),
  };

  return new Blob([zipStore(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function createWorksheetXml(rows) {
  const widths = [10, 30, 54, 28, 30, 38, ...Array(Math.max(1, rows[0].length - 6)).fill(90)];
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
      const style = worksheetStyle(rowIndex, row);
      return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`;
    }).join("");
    const outputLineCount = row.slice(6).reduce((max, value) => Math.max(max, String(value || "").split("\n").length), 1);
    const height = rowIndex < 2 ? 22 : Math.min(220, Math.max(42, outputLineCount * 12));
    return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");

  const colXml = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const mergeXml = `<mergeCells count="5"><mergeCell ref="A1:A2"/><mergeCell ref="B1:B2"/><mergeCell ref="C1:C2"/><mergeCell ref="D1:D2"/><mergeCell ref="E1:F1"/></mergeCells>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colXml}</cols>
  <sheetData>${rowXml}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function worksheetStyle(rowIndex, row) {
  if (rowIndex < 2) return 1;
  const ref = String(row[0] || "");
  if (/^\d+$/.test(ref)) return 3;
  if (/^\d+\.\d+$/.test(ref)) return 4;
  return 2;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, content]) => ({
    name,
    nameBytes: encoder.encode(name),
    data: content instanceof Uint8Array ? content : encoder.encode(content),
  }));

  let offset = 0;
  const localParts = [];
  const centralParts = [];

  for (const entry of entries) {
    const crc = crc32(entry.data);
    const localHeader = concatBytes(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), entry.nameBytes
    );
    localParts.push(localHeader, entry.data);

    centralParts.push(concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), entry.nameBytes
    ));

    offset += localHeader.length + entry.data.length;
  }

  const centralDirectory = concatBytes(...centralParts);
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralDirectory.length), u32(offset), u16(0)
  );

  return concatBytes(...localParts, centralDirectory, end);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return c >>> 0;
});

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const item of arrays) {
    output.set(item, offset);
    offset += item.length;
  }
  return output;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - remainder) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xml(value) {
  return value.trim();
}
