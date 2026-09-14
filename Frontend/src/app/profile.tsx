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
import { LinearGradient } from '@/components/common/LinearGradient';
import { useAuth } from '@/services/authContext';
import { MapSettingsModal } from '@/components/settings/MapSettingsModal';
import { MapTileLayerType } from '@/types/navigation';
import { SkyColors, SkyGradients } from '@/constants/theme';

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
    <View style={[styles.container, { backgroundColor: '#ffffff' }]}>
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
            <Text style={[styles.backBtnText, { color: '#2C5EAD' }]}>← Back to Map</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: '#000000' }]}>
            User Profile
          </Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Identity Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
              borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
            },
          ]}>
          {/* Avatar Circle with Sky Gradient */}
          {isGuest ? (
            <View
              style={[
                styles.avatarLarge,
                {
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  borderColor: '#f59e0b',
                },
              ]}>
              <Text style={styles.avatarLargeText}>👤</Text>
            </View>
          ) : (
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={SkyGradients.radial1Colors}
                radialPreset="radial1"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarLargeGradient}>
                <Text style={[styles.avatarLargeText, { color: '#ffffff' }]}>
                  {user?.username ? user.username[0].toUpperCase() : '👤'}
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Name & Email */}
          <Text style={[styles.userNameText, { color: '#000000' }]}>
            {isGuest ? 'Guest Explorer' : user?.username}
          </Text>
          <Text style={[styles.userEmailText, { color: '#000000' }]}>
            {isGuest ? 'No account linked (Guest Mode)' : user?.email}
          </Text>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isGuest
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(56, 189, 248, 0.15)',
                borderColor: isGuest ? 'rgba(234, 179, 8, 0.4)' : SkyColors.skyBorderDark,
              },
            ]}>
            <Text
              style={[
                styles.statusBadgeText,
                { color: isGuest ? '#f59e0b' : SkyColors.sky400 },
              ]}>
              {isGuest ? '🟡 Guest Mode (Read Only)' : '✨ Verified Explorer • Full Access'}
            </Text>
          </View>
        </View>

        {/* Detailed User Information Card */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: '#2C5EAD' }]}>
            ACCOUNT DETAILS
          </Text>
          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
              },
            ]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#000000' }]}>
                👤 Username
              </Text>
              <Text style={[styles.detailValue, { color: '#000000' }]}>
                {isGuest ? 'Guest' : user?.username}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#000000' }]}>
                ✉️ Email Address
              </Text>
              <Text style={[styles.detailValue, { color: '#000000' }]}>
                {isGuest ? 'Not registered' : user?.email}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#000000' }]}>
                🛡️ Account Status
              </Text>
              <Text style={[styles.detailValue, { color: isGuest ? '#f59e0b' : '#10b981' }]}>
                {isGuest ? 'Guest Session' : 'Active Registered User'}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#000000' }]}>
                🧭 Navigation Access
              </Text>
              <Text style={[styles.detailValue, { color: '#000000' }]}>
                {isGuest ? 'Map View Only' : 'Search, Routing & Live Nav'}
              </Text>
            </View>

            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]} />

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#000000' }]}>
                ⚡ Engine Status
              </Text>
              <Text style={[styles.detailValue, { color: '#2C5EAD' }]}>
                Valhalla + ONNX Dead Reckoning
              </Text>
            </View>
          </View>
        </View>

        {/* Horizontal Settings Button */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: isDark ? SkyColors.sky400 : SkyColors.sky600 }]}>
            SYSTEM CONTROLS
          </Text>
          <TouchableOpacity
            style={[
              styles.horizontalSettingsBtn,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
              },
            ]}
            onPress={handleOpenSettingsOnMap}
            activeOpacity={0.8}>
            <View style={styles.settingsBtnIconCircle}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </View>
            <View style={styles.settingsBtnTextCol}>
              <Text style={[styles.settingsBtnTitle, { color: '#000000' }]}>
                Map & System Settings
              </Text>
              <Text style={[styles.settingsBtnSub, { color: '#000000' }]}>
                Offline tiles, cartography layers, road graph & voice guidance
              </Text>
            </View>
            <View style={styles.settingsBtnArrowBadge}>
              <Text style={styles.settingsBtnArrowText}>Open →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Favourite Places Navigation */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: '#2C5EAD' }]}>
            SAVED PLACES
          </Text>
          <TouchableOpacity
            style={[
              styles.horizontalSettingsBtn,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? 'rgba(234, 179, 8, 0.35)' : 'rgba(202, 138, 4, 0.3)',
              },
            ]}
            onPress={() => router.push('/favourites')}
            activeOpacity={0.8}>
            <View style={[styles.settingsBtnIconCircle, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
              <Text style={{ fontSize: 20 }}>⭐</Text>
            </View>
            <View style={styles.settingsBtnTextCol}>
              <Text style={[styles.settingsBtnTitle, { color: '#000000' }]}>
                Favourite Places
              </Text>
              <Text style={[styles.settingsBtnSub, { color: '#000000' }]}>
                View and manage saved destinations, home, work, and bookmarked pins
              </Text>
            </View>
            <View style={[styles.settingsBtnArrowBadge, { backgroundColor: 'rgba(234, 179, 8, 0.18)' }]}>
              <Text style={[styles.settingsBtnArrowText, { color: '#eab308' }]}>Open →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Feedback & Bug Reports Navigation */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: '#2C5EAD' }]}>
            HELP & COMMUNITY
          </Text>
          <TouchableOpacity
            style={[
              styles.horizontalSettingsBtn,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)',
              },
            ]}
            onPress={() => router.push('/feedback')}
            activeOpacity={0.8}>
            <View style={[styles.settingsBtnIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.18)' }]}>
              <Text style={{ fontSize: 20 }}>💬</Text>
            </View>
            <View style={styles.settingsBtnTextCol}>
              <Text style={[styles.settingsBtnTitle, { color: '#000000' }]}>
                Feedback & Bug Reports
              </Text>
              <Text style={[styles.settingsBtnSub, { color: '#000000' }]}>
                Report issues, suggest features, and track your submitted feedback
              </Text>
            </View>
            <View style={[styles.settingsBtnArrowBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
              <Text style={[styles.settingsBtnArrowText, { color: SkyColors.sky400 }]}>Open →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Authentication Actions */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionHeading, { color: '#2C5EAD' }]}>
            SESSION ACTIONS
          </Text>

          {isGuest ? (
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/signup')}
                activeOpacity={0.85}
                style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient
                  colors={SkyGradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>🚀 Sign Up for Full Account</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/login')}
                activeOpacity={0.85}
                style={{ borderRadius: 16, overflow: 'hidden' }}>
                <LinearGradient
                  colors={SkyGradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>
                    🔑 Log In to Existing Account
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E45742' }]}
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
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: '#38bdf8',
  },
  avatarLargeGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
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
    shadowColor: '#2C5EAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  settingsBtnIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(44, 94, 173, 0.10)',
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
    backgroundColor: 'rgba(44, 94, 173, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginLeft: 8,
  },
  settingsBtnArrowText: {
    color: '#2C5EAD',
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
