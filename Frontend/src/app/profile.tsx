import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/services/authContext';
import { MapSettingsModal } from '@/components/settings/MapSettingsModal';
import { MapTileLayerType } from '@/types/navigation';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isGuest, logout } = useAuth();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapTileLayerType>('osm_standard');
  const [showValhallaTiles, setShowValhallaTiles] = useState(true);
  const [voiceGuidance, setVoiceGuidance] = useState(true);

  const handleBackToMap = () => {
    router.replace('/');
  };

  const handleOpenSettingsOnMap = () => {
    // Navigate to map and trigger settings modal
    router.replace({ pathname: '/', params: { openSettings: '1' } });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#090d16' : '#f8fafc' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 36),
            paddingBottom: Math.max(insets.bottom + 24, 40),
          },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Top Navigation Row */}
        <View style={styles.topNavRow}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back to Map</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            User Profile
          </Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Identity Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
            },
          ]}>
          {/* Avatar Circle */}
          <View
            style={[
              styles.avatarLarge,
              {
                backgroundColor: isGuest
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(2, 132, 199, 0.2)',
                borderColor: isGuest ? '#f59e0b' : '#38bdf8',
              },
            ]}>
            <Text style={styles.avatarLargeText}>
              {isGuest ? '👤' : (user?.username ? user.username[0].toUpperCase() : '👤')}
            </Text>
          </View>

          {/* Name & Email */}
          <Text style={[styles.userNameText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            {isGuest ? 'Guest Explorer' : user?.username}
          </Text>
          <Text style={[styles.userEmailText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {isGuest ? 'No account linked (Guest Mode)' : user?.email}
          </Text>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isGuest
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(16, 185, 129, 0.15)',
                borderColor: isGuest ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.4)',
              },
            ]}>
            <Text
              style={[
                styles.statusBadgeText,
                { color: isGuest ? '#f59e0b' : '#10b981' },
              ]}>
              {isGuest ? '🟡 Guest Mode (Read Only)' : '🟢 Verified Explorer • Full Access'}
            </Text>
          </View>
        </View>

        {/* Detailed User Information Card */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
            ACCOUNT DETAILS
          </Text>
          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              },
            ]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                👤 Username
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {isGuest ? 'Guest' : user?.username}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                ✉️ Email Address
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {isGuest ? 'Not registered' : user?.email}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                🛡️ Account Status
              </Text>
              <Text style={[styles.detailValue, { color: isGuest ? '#f59e0b' : '#10b981' }]}>
                {isGuest ? 'Guest Session' : 'Active Registered User'}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                🧭 Navigation Access
              </Text>
              <Text style={[styles.detailValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {isGuest ? 'Map View Only' : 'Search, Routing & Live Nav'}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                ⚡ Engine Status
              </Text>
              <Text style={[styles.detailValue, { color: '#38bdf8' }]}>
                Valhalla + ONNX Dead Reckoning
              </Text>
            </View>
          </View>
        </View>

        {/* Horizontal Settings Button */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
            SYSTEM CONTROLS
          </Text>
          <TouchableOpacity
            style={[
              styles.horizontalSettingsBtn,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.3)',
              },
            ]}
            onPress={handleOpenSettingsOnMap}
            activeOpacity={0.8}>
            <View style={styles.settingsBtnIconCircle}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </View>
            <View style={styles.settingsBtnTextCol}>
              <Text style={[styles.settingsBtnTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Map & System Settings
              </Text>
              <Text style={[styles.settingsBtnSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Offline tiles, cartography layers, road graph & voice guidance
              </Text>
            </View>
            <View style={styles.settingsBtnArrowBadge}>
              <Text style={styles.settingsBtnArrowText}>Open →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Feedback & Bug Reports Navigation */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
            HELP & COMMUNITY
          </Text>
          <TouchableOpacity
            style={[
              styles.horizontalSettingsBtn,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.3)',
              },
            ]}
            onPress={() => router.push('/feedback')}
            activeOpacity={0.8}>
            <View style={[styles.settingsBtnIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Text style={{ fontSize: 20 }}>💬</Text>
            </View>
            <View style={styles.settingsBtnTextCol}>
              <Text style={[styles.settingsBtnTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Feedback & Bug Reports
              </Text>
              <Text style={[styles.settingsBtnSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Report issues, suggest features, and track your submitted feedback
              </Text>
            </View>
            <View style={[styles.settingsBtnArrowBadge, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
              <Text style={[styles.settingsBtnArrowText, { color: '#f59e0b' }]}>Open →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Authentication Actions */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
            SESSION ACTIONS
          </Text>

          {isGuest ? (
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
                onPress={() => router.push('/signup')}
                activeOpacity={0.85}>
                <Text style={styles.actionBtnText}>🚀 Sign Up for Full Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#e2e8f0',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  },
                ]}
                onPress={() => router.push('/login')}
                activeOpacity={0.85}>
                <Text style={[styles.actionBtnText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  🔑 Log In to Existing Account
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => {
                logout();
                router.replace('/');
              }}
              activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>🚪 Log Out to Guest Mode</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Settings Modal (if opened directly on profile screen) */}
      <MapSettingsModal
        visible={showSettingsModal}
        activeLayer={activeLayer}
        showValhallaTiles={showValhallaTiles}
        voiceGuidance={voiceGuidance}
        offlineTileCount={0}
        cacheSizeMb="0.0"
        isGuest={isGuest}
        userName={user?.username}
        userEmail={user?.email}
        onRequireAuth={() => {
          setShowSettingsModal(false);
          router.push('/signup');
        }}
        onLogout={() => {
          setShowSettingsModal(false);
          logout();
        }}
        onClose={() => setShowSettingsModal(false)}
        onSelectLayer={setActiveLayer}
        onToggleValhallaTiles={() => setShowValhallaTiles(!showValhallaTiles)}
        onToggleVoiceGuidance={() => setVoiceGuidance(!voiceGuidance)}
        onDownloadArea={() => {}}
        onClearCache={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  topNavRow: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarLargeText: {
    fontSize: 36,
    fontWeight: '800',
  },
  userNameText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  userEmailText: {
    fontSize: 13,
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionWrapper: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 22,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  detailsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailDivider: {
    height: 1,
    width: '100%',
  },
  horizontalSettingsBtn: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  settingsBtnIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsBtnTextCol: {
    flex: 1,
  },
  settingsBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  settingsBtnSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  settingsBtnArrowBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginLeft: 8,
  },
  settingsBtnArrowText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtn: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
