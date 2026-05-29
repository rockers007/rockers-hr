# Graph Report - .  (2026-05-29)

## Corpus Check
- Corpus is ~42,171 words - fits in a single context window. You may not need a graph.

## Summary
- 621 nodes · 673 edges · 36 communities (33 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.84)
- Token cost: 1,200 input · 620 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Leave Application Flow|Leave Application Flow]]
- [[_COMMUNITY_Leave Service + Auth Concepts|Leave Service + Auth Concepts]]
- [[_COMMUNITY_App Theme + Auth Gateway|App Theme + Auth Gateway]]
- [[_COMMUNITY_Overtime Management|Overtime Management]]
- [[_COMMUNITY_Leave Detail View|Leave Detail View]]
- [[_COMMUNITY_API Layer + Master Data|API Layer + Master Data]]
- [[_COMMUNITY_Home Dashboard|Home Dashboard]]
- [[_COMMUNITY_Employee Profile|Employee Profile]]
- [[_COMMUNITY_App Entry + AuthGate|App Entry + AuthGate]]
- [[_COMMUNITY_Investment Proofs|Investment Proofs]]
- [[_COMMUNITY_Bank Details Screen|Bank Details Screen]]
- [[_COMMUNITY_Payroll Hub|Payroll Hub]]
- [[_COMMUNITY_Navigation + Leave History|Navigation + Leave History]]
- [[_COMMUNITY_Notifications Screen|Notifications Screen]]
- [[_COMMUNITY_Salary Breakdown|Salary Breakdown]]
- [[_COMMUNITY_Leave History View|Leave History View]]
- [[_COMMUNITY_Payslips Screen|Payslips Screen]]
- [[_COMMUNITY_Payroll Data Models|Payroll Data Models]]
- [[_COMMUNITY_App Dependencies + Linting|App Dependencies + Linting]]
- [[_COMMUNITY_Manager Approvals|Manager Approvals]]
- [[_COMMUNITY_Edit Profile Screen|Edit Profile Screen]]
- [[_COMMUNITY_Authentication Service|Authentication Service]]
- [[_COMMUNITY_Leave Domain Models|Leave Domain Models]]
- [[_COMMUNITY_Global Progress Widget|Global Progress Widget]]
- [[_COMMUNITY_Login Screen|Login Screen]]
- [[_COMMUNITY_Leave Balance Widget|Leave Balance Widget]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Avatar Widget|Avatar Widget]]
- [[_COMMUNITY_Leave Request Widget|Leave Request Widget]]
- [[_COMMUNITY_Android Launcher Icons|Android Launcher Icons]]
- [[_COMMUNITY_Flutter Plugin Registry|Flutter Plugin Registry]]
- [[_COMMUNITY_Android Main Activity|Android Main Activity]]
- [[_COMMUNITY_Android Build Config|Android Build Config]]

## God Nodes (most connected - your core abstractions)
1. `rockers_hr pubspec` - 13 edges
2. `ApiService` - 10 edges
3. `AuthService` - 9 edges
4. `HomeScreen` - 8 edges
5. `ApiException` - 8 edges
6. `Flutter Default Launcher Icon` - 7 edges
7. `User` - 6 edges
8. `PayrollScreen` - 6 edges
9. `ApprovalsScreen` - 6 edges
10. `LeaveDetailScreen` - 6 edges

## Surprising Connections (you probably didn't know these)
- `_ApplyLeaveScreenState` --references--> `CalculateResult`  [EXTRACTED]
  mobile/lib/screens/apply_leave_screen.dart → lib/models/leave_models.dart
- `BankChangeScreen` --implements--> `Bank Details First-Time vs Change-Request flow`  [EXTRACTED]
  lib/screens/bank_change_screen.dart → mobile/lib/screens/bank_change_screen.dart
- `OvertimeService` --semantically_similar_to--> `LeaveService`  [INFERRED] [semantically similar]
  lib/services/overtime_service.dart → lib/services/leave_service.dart
- `RockersHrApp` --references--> `AppTheme`  [EXTRACTED]
  mobile/lib/main.dart → lib/config/theme.dart
- `_ApplyLeaveScreenState` --references--> `LeaveType`  [EXTRACTED]
  mobile/lib/screens/apply_leave_screen.dart → lib/models/leave_models.dart

## Hyperedges (group relationships)
- **Payroll Feature Screen Cluster** — screens_payroll_screen_payrollscreen, screens_payslips_screen_payslipsscreen, screens_bank_change_screen_bankchangescreen, models_payroll_models_payrollsalary, models_payroll_models_paysliprow, models_payroll_models_ytdrow, models_payroll_models_bankchangerequest [EXTRACTED 0.95]
- **Leave Application Flow (Models + Screen + Services)** — screens_apply_leave_screen_applyleavescreen, models_leave_models_leavetype, models_leave_models_leaveduration, models_leave_models_leavebalance, models_leave_models_calculateresult, concept_sandwich_leave_ack, concept_employment_ended_guard [EXTRACTED 0.95]
- **Authentication Gate and Profile Activation Cluster** — main_auth_gate, screens_complete_profile_screen_completeprofilescreen, concept_auth_gate_routing, concept_master_data_prefetch [EXTRACTED 0.95]
- **API Inflight Progress Tracking Triad** — services_api_service_apiservice, widgets_global_progress_bar_globalprogressbar, concept_inflight_progress_pattern [EXTRACTED 0.95]
- **Leave Approval Workflow (Manager L1 flow)** — screens_approvals_screen_approvalsscreen, services_leave_service_leaveservice, widgets_approval_card_approvalcard [EXTRACTED 0.95]
- **Master Data Dropdowns used in Profile Editing** — screens_edit_profile_screen_editprofilescreen, services_master_data_service_masterdataservice, concept_master_data_dropdowns [INFERRED 0.90]
- **FCM Push Notification Stack** — pubspec_firebase_core, pubspec_firebase_messaging, pubspec_fcm_integration [EXTRACTED 1.00]
- **Authentication Token Secure Storage** — pubspec_google_sign_in, pubspec_flutter_secure_storage, pubspec_secure_token_storage [INFERRED 0.85]
- **Flutter App Core Dependencies** — pubspec_rockers_hr, pubspec_provider, pubspec_http [EXTRACTED 1.00]
- **Android Launcher Icon Density Set (mdpi through xxxhdpi)** — mipmap_mdpi_ic_launcher_appicon, mipmap_hdpi_ic_launcher_appicon, mipmap_xhdpi_ic_launcher_appicon, mipmap_xxhdpi_ic_launcher_appicon, mipmap_xxxhdpi_ic_launcher_appicon [EXTRACTED 1.00]
- **Flutter Default Launcher Icon Instances Across Android Densities** — mipmap_mdpi_ic_launcher_appicon, mipmap_hdpi_ic_launcher_appicon, mipmap_xhdpi_ic_launcher_appicon, mipmap_xxhdpi_ic_launcher_appicon, mipmap_xxxhdpi_ic_launcher_appicon, flutter_default_launcher_icon_concept, flutter_brand_identity_concept [EXTRACTED 1.00]

## Communities (36 total, 3 thin omitted)

### Community 0 - "Leave Application Flow"
Cohesion: 0.05
Nodes (41): AppConfig, dart:io, ../config/theme.dart, ../models/leave_models.dart, package:flutter/material.dart, package:intl/intl.dart, package:provider/provider.dart, ../services/api_service.dart (+33 more)

### Community 1 - "Leave Service + Auth Concepts"
Cohesion: 0.06
Nodes (38): avatar_circle.dart, JWT Auth Flow (email+password primary, Google legacy), Role-Gated Navigation, dart:developer, api_service.dart, package:flutter/foundation.dart, ../config/theme.dart, leave_balance_card.dart (+30 more)

### Community 2 - "App Theme + Auth Gateway"
Cohesion: 0.07
Nodes (31): Three-way AuthGate routing pattern, Master Data prefetch strategy, AppColors, AppTheme, ThemeData, package:flutter/material.dart, ../config/theme.dart, package:flutter/material.dart (+23 more)

### Community 3 - "Overtime Management"
Cohesion: 0.07
Nodes (27): ../config/theme.dart, package:flutter/material.dart, package:intl/intl.dart, build, _buildForm, _buildRequestCard, _buildSummary, _calcHours (+19 more)

### Community 4 - "Leave Detail View"
Cohesion: 0.07
Nodes (26): ../config/theme.dart, ../models/leave_models.dart, package:flutter/material.dart, package:intl/intl.dart, ../services/api_service.dart, ../services/leave_service.dart, ../widgets/leave_balance_card.dart, _approvalStatusText (+18 more)

### Community 5 - "API Layer + Master Data"
Cohesion: 0.09
Nodes (23): In-flight API Progress Pattern, Dynamic Master Data Dropdowns, ../config/app_config.dart, dart:convert, package:flutter/foundation.dart, api_service.dart, package:flutter/foundation.dart, api_service.dart (+15 more)

### Community 6 - "Home Dashboard"
Cohesion: 0.08
Nodes (25): ../config/theme.dart, leave_detail_screen.dart, ../models/leave_models.dart, package:flutter/material.dart, package:intl/intl.dart, package:provider/provider.dart, ../services/api_service.dart, ../services/auth_service.dart (+17 more)

### Community 7 - "Employee Profile"
Cohesion: 0.08
Nodes (25): change_password_screen.dart, edit_profile_screen.dart, ../config/theme.dart, ../models/leave_models.dart, package:flutter/material.dart, package:intl/intl.dart, package:provider/provider.dart, ../services/api_service.dart (+17 more)

### Community 8 - "App Entry + AuthGate"
Cohesion: 0.08
Nodes (24): AuthGate, _AuthGateState, build, CompleteProfileScreen, config/theme.dart, package:flutter/material.dart, package:provider/provider.dart, services/auth_service.dart (+16 more)

### Community 9 - "Investment Proofs"
Cohesion: 0.09
Nodes (22): ../config/theme.dart, ../models/payroll_models.dart, package:flutter/material.dart, package:intl/intl.dart, ../services/payroll_service.dart, api_service.dart, ../models/payroll_models.dart, build (+14 more)

### Community 10 - "Bank Details Screen"
Cohesion: 0.09
Nodes (22): ../config/theme.dart, ../models/payroll_models.dart, package:flutter/material.dart, package:intl/intl.dart, ../services/payroll_service.dart, _BankChangeScreenState, build, Container (+14 more)

### Community 11 - "Payroll Hub"
Cohesion: 0.09
Nodes (22): bank_change_screen.dart, investment_proofs_screen.dart, ../config/theme.dart, ../models/payroll_models.dart, package:flutter/material.dart, package:intl/intl.dart, ../services/payroll_service.dart, payslips_screen.dart (+14 more)

### Community 12 - "Navigation + Leave History"
Cohesion: 0.09
Nodes (21): apply_leave_screen.dart, approvals_screen.dart, history_screen.dart, home_screen.dart, ../config/theme.dart, package:flutter/material.dart, package:provider/provider.dart, ../services/auth_service.dart (+13 more)

### Community 13 - "Notifications Screen"
Cohesion: 0.10
Nodes (19): ../config/theme.dart, leave_detail_screen.dart, package:flutter/material.dart, ../services/api_service.dart, ../services/leave_service.dart, ../widgets/empty_state.dart, AppNotification, ../models/notification_model.dart (+11 more)

### Community 14 - "Salary Breakdown"
Cohesion: 0.11
Nodes (18): ../config/theme.dart, ../models/payroll_models.dart, package:flutter/material.dart, ../services/payroll_service.dart, build, _componentRow, Divider, initState (+10 more)

### Community 15 - "Leave History View"
Cohesion: 0.11
Nodes (17): ../config/theme.dart, leave_detail_screen.dart, ../models/leave_models.dart, package:flutter/material.dart, ../services/api_service.dart, ../services/leave_service.dart, ../widgets/empty_state.dart, ../widgets/leave_request_card.dart (+9 more)

### Community 16 - "Payslips Screen"
Cohesion: 0.12
Nodes (16): ../config/theme.dart, ../models/payroll_models.dart, package:flutter/material.dart, package:intl/intl.dart, ../services/payroll_service.dart, package:flutter/services.dart, build, Container (+8 more)

### Community 17 - "Payroll Data Models"
Cohesion: 0.18
Nodes (16): Bank Details First-Time vs Change-Request flow, BankChangeRequest, BreakdownRow, ComputedPreview, _d, formatInr, _indianGroup, InvestmentProof (+8 more)

### Community 18 - "App Dependencies + Linting"
Cohesion: 0.15
Nodes (17): Flutter Linting Configuration, cached_network_image, cupertino_icons, Firebase Cloud Messaging Integration, firebase_core, firebase_messaging, flutter_lints, flutter_secure_storage (+9 more)

### Community 19 - "Manager Approvals"
Cohesion: 0.12
Nodes (15): ../config/theme.dart, ../models/leave_models.dart, package:flutter/material.dart, ../services/api_service.dart, ../services/leave_service.dart, ../widgets/empty_state.dart, ApprovalCard, _ApprovalsScreenState (+7 more)

### Community 20 - "Edit Profile Screen"
Cohesion: 0.13
Nodes (14): ../config/theme.dart, package:flutter/material.dart, package:provider/provider.dart, ../services/api_service.dart, ../services/auth_service.dart, ../services/master_data_service.dart, build, dispose (+6 more)

### Community 21 - "Authentication Service"
Cohesion: 0.13
Nodes (14): api_service.dart, dart:convert, package:flutter/foundation.dart, ../models/user_model.dart, package:flutter/scheduler.dart, package:flutter_secure_storage/flutter_secure_storage.dart, package:google_sign_in/google_sign_in.dart, package:rockers_hr/services/logging_service.dart (+6 more)

### Community 22 - "Leave Domain Models"
Cohesion: 0.24
Nodes (13): Employment Ended Leave Application Guard, Sandwich Leave Acknowledgement UX, ApproverRef, CalculateResult, LeaveApproval, LeaveBalance, LeaveDuration, LeaveDurationRef (+5 more)

### Community 23 - "Global Progress Widget"
Cohesion: 0.14
Nodes (13): dart:async, ../config/theme.dart, package:flutter/material.dart, ../services/api_service.dart, build, dispose, _finish, _GlobalProgressBarState (+5 more)

### Community 24 - "Login Screen"
Cohesion: 0.15
Nodes (12): ../config/theme.dart, package:flutter/material.dart, package:provider/provider.dart, ../services/api_service.dart, ../services/auth_service.dart, build, dispose, Divider (+4 more)

### Community 25 - "Leave Balance Widget"
Cohesion: 0.20
Nodes (9): ../config/theme.dart, package:flutter/material.dart, build, Color, Container, _formatDays, hexToColor, LeaveBalanceCard (+1 more)

### Community 26 - "Brand Identity"
Cohesion: 0.39
Nodes (9): Rockers Technologies USA Logo (2x), Rockers Technologies USA Logo (3x), Rockers Technologies USA Brand Identity, Rockers Technologies USA Logo (1x), Brand Color: Dark Navy/Indigo, Brand Color: Teal/Steel Blue, Logo Resolution Set (1x/2x/3x) for Flutter Mobile, Teal Swoosh Arc Graphic Element (+1 more)

### Community 27 - "Avatar Widget"
Cohesion: 0.22
Nodes (8): ../config/theme.dart, package:flutter/material.dart, package:cached_network_image/cached_network_image.dart, build, Container, _initials, _initialsWidget, SizedBox

### Community 28 - "Leave Request Widget"
Cohesion: 0.22
Nodes (8): ../config/theme.dart, leave_balance_card.dart, package:flutter/material.dart, status_badge.dart, build, Card, _formatDays, SizedBox

### Community 29 - "Android Launcher Icons"
Cohesion: 0.57
Nodes (8): Android Mipmap Density System, Flutter Brand Identity (Light Blue and Dark Blue Chevron Logo), Flutter Default Launcher Icon, App Launcher Icon (hdpi), App Launcher Icon (mdpi), App Launcher Icon (xhdpi), App Launcher Icon (xxhdpi), App Launcher Icon (xxxhdpi)

## Knowledge Gaps
- **479 isolated node(s):** `MainActivity`, `RockersHrApp`, `AuthGate`, `_AuthGateState`, `main` (+474 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiException` connect `Leave Service + Auth Concepts` to `Investment Proofs`, `API Layer + Master Data`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `HomeScreen` connect `Leave Service + Auth Concepts` to `Leave Balance Widget`, `Home Dashboard`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Leave Service + Auth Concepts` to `API Layer + Master Data`, `Authentication Service`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `ApiService` (e.g. with `OvertimeRequest` and `In-flight API Progress Pattern`) actually correct?**
  _`ApiService` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `MainActivity`, `RockersHrApp`, `AuthGate` to the rest of the system?**
  _483 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Leave Application Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Leave Service + Auth Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.058693244739756366 - nodes in this community are weakly interconnected._