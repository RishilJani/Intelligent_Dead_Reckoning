import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  useColorScheme,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/common/LinearGradient';
import { useAuth } from '@/services/authContext';
import { getUserFromCache } from '@/services/userCache';
import {
  FavouriteItem,
  getFavouritesByUserId,
  addFavourite,
  deleteFavourite,
} from '@/services/favouriteService';
import { SkyColors, SkyGradients } from '@/constants/theme';

export default function FavouritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isGuest } = useAuth();

  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFavName, setNewFavName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLon, setNewLon] = useState('');
  const [adding, setAdding] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchFavourites = useCallback(async (isPullRefresh = false) => {
    const cachedUser = getUserFromCache();
    const userId = user?.user_id || user?.id || cachedUser.user_id;

    if (!userId || isGuest) {
      setFavourites([]);
      return;
    }

    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getFavouritesByUserId(userId);
      setFavourites(data);
    } catch (err: any) {
      console.warn('Failed to load favourites:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const handleNavigateToPlace = (item: FavouriteItem) => {
    router.navigate({
      pathname: '/',
      params: {
        destLat: String(item.latitude),
        destLon: String(item.longitude),
        destName: item.fav_name,
      },
    });
  };

  const handleDeleteFavourite = (favId: number, favName: string) => {
    const confirmDelete = async () => {
      try {
        await deleteFavourite(favId);
        setFavourites((prev) => prev.filter((f) => f.fav_id !== favId));
        if (Platform.OS === 'web') {
          window.alert(`"${favName}" removed from favourites.`);
        } else {
          Alert.alert('Removed', `"${favName}" removed from favourites.`);
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to remove favourite');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${favName}" from favourite places?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Remove Favourite',
        `Are you sure you want to remove "${favName}" from your favourites?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const handleManualAdd = async () => {
    const name = newFavName.trim();
    const lat = parseFloat(newLat.trim());
    const lon = parseFloat(newLon.trim());

    if (!name) {
      setModalError('Please enter a place name.');
      return;
    }
    if (isNaN(lat) || isNaN(lon)) {
      setModalError('Please enter valid numerical latitude and longitude.');
      return;
    }

    const cachedUser = getUserFromCache();
    const userId = user?.user_id || user?.id || cachedUser.user_id;
    if (!userId || isGuest) {
      setModalError('Please sign in or register to save favourite places.');
      return;
    }

    setAdding(true);
    setModalError(null);

    try {
      await addFavourite({
        user_id: userId,
        fav_name: name,
        latitude: lat,
        longitude: lon,
      });

      setNewFavName('');
      setNewLat('');
      setNewLon('');
      setShowAddModal(false);
      await fetchFavourites();
      if (Platform.OS === 'web') {
        window.alert('Favourite place added successfully!');
      } else {
        Alert.alert('Success', 'Favourite place added successfully!');
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to add favourite place.');
    } finally {
      setAdding(false);
    }
  };

  const filteredFavourites = favourites.filter((item) =>
    item.fav_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFavourites(true)}
            tintColor={SkyColors.sky400}
          />
        }>
        {/* Top Nav Row */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Text style={[styles.backBtnText, { color: '#2C5EAD' }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: '#000000' }]}>
            Favourite Places
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (isGuest) {
                router.push('/login');
              } else {
                setModalError(null);
                setShowAddModal(true);
              }
            }}
            activeOpacity={0.8}
            style={{ borderRadius: 12, overflow: 'hidden', opacity: isGuest ? 0.6 : 1 }}>
            <LinearGradient
              colors={SkyGradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBtnGradient}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Guest Warning */}
        {isGuest ? (
          <View
            style={[
              styles.guestCard,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: '#f59e0b',
              },
            ]}>
            <View style={styles.guestCardIcon}>
              <Text style={{ fontSize: 24 }}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guestCardTitle, { color: '#000000' }]}>
                Guest Session
              </Text>
              <Text style={[styles.guestCardSub, { color: '#000000' }]}>
                Log in or sign up to save favourite places, access them offline, and get 1-tap navigation.
              </Text>
              <View style={styles.guestActionsRow}>
                <TouchableOpacity
                  style={styles.guestLoginBtn}
                  onPress={() => router.push('/login')}
                  activeOpacity={0.8}>
                  <Text style={styles.guestLoginBtnText}>Log In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestSignupBtn}
                  onPress={() => router.push('/signup')}
                  activeOpacity={0.8}>
                  <Text style={styles.guestSignupBtnText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* User Status & Count Card */
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : SkyColors.skyBorderLight,
              },
            ]}>
            <View style={styles.summaryLeft}>
              <View style={[styles.summaryIconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : SkyColors.sky100 }]}>
                <Text style={{ fontSize: 24 }}>⭐</Text>
              </View>
              <View>
                <Text style={[styles.summaryName, { color: '#000000' }]}>
                  {user?.user_name || user?.username || 'Navigator'}
                </Text>
                <Text style={[styles.summarySub, { color: '#000000' }]}>
                  {favourites.length} {favourites.length === 1 ? 'saved location' : 'saved locations'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.exploreMapBtn}
              onPress={() => router.navigate('/')}
              activeOpacity={0.8}>
              <Text style={styles.exploreMapBtnText}>🗺️ Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        {favourites.length > 0 && (
          <View style={styles.searchWrapper}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: isDark ? SkyColors.skyNight : SkyColors.sky50,
                  color: '#000000',
                  borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.sky200,
                },
              ]}
              placeholder="Search saved places..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={SkyColors.sky400} />
            <Text style={[styles.loadingText, { color: '#000000' }]}>
              Loading favourite places...
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !isGuest && filteredFavourites.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
              },
            ]}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={[styles.emptyTitle, { color: '#000000' }]}>
              {searchQuery ? 'No places match your search' : 'No favourite places yet'}
            </Text>
            <Text style={[styles.emptySub, { color: '#1f2937' }]}>
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : 'When checking directions on the map, tap the star (⭐) icon on any place card to add it to your favourites!'}
            </Text>
            <TouchableOpacity
              onPress={() => router.navigate('/')}
              activeOpacity={0.85}
              style={{ borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient
                colors={SkyGradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyActionBtn}>
                <Text style={styles.emptyActionBtnText}>🧭 Go to Map to Save Places</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* List of Favourites */}
        {!loading &&
          filteredFavourites.map((item) => (
            <View
              key={item.fav_id}
              style={[
                styles.favCard,
                {
                  backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                  borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
                },
              ]}>
              <View style={styles.favCardContent}>
                <View style={[styles.favIconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.18)' : SkyColors.sky100 }]}>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.favTitle, { color: '#000000' }]}>
                    {item.fav_name}
                  </Text>
                  <Text style={[styles.favCoords, { color: '#000000' }]}>
                    {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                  </Text>
                </View>
              </View>

              {/* Actions Row */}
              <View style={[styles.favActionsRow, { borderTopColor: isDark ? 'rgba(56, 189, 248, 0.15)' : SkyColors.sky100 }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.navigateBtnWrapper]}
                  onPress={() => handleNavigateToPlace(item)}
                  activeOpacity={0.85}>
                  <LinearGradient
                    colors={SkyGradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.navigateGradient}>
                    <Text style={styles.navigateBtnText}>Check Direction</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteFavourite(item.fav_id, item.fav_name)}
                  activeOpacity={0.7}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Manual Add Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? SkyColors.skyCardDark : '#ffffff',
                borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.skyBorderLight,
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: '#000000' }]}>
                ⭐ Add Favourite Place
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: '#000000' }]}>
              Place Name:
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? SkyColors.skyNight : SkyColors.sky50,
                  color: '#000000',
                  borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.sky200,
                },
              ]}
              placeholder="e.g. Home, Office, University..."
              placeholderTextColor="#64748b"
              value={newFavName}
              onChangeText={setNewFavName}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: '#000000' }]}>
                  Latitude:
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? SkyColors.skyNight : SkyColors.sky50,
                      color: '#000000',
                      borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.sky200,
                    },
                  ]}
                  placeholder="e.g. 28.6139"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={newLat}
                  onChangeText={setNewLat}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: '#000000' }]}>
                  Longitude:
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? SkyColors.skyNight : SkyColors.sky50,
                      color: '#000000',
                      borderColor: isDark ? SkyColors.skyBorderDark : SkyColors.sky200,
                    },
                  ]}
                  placeholder="e.g. 77.2090"
                  keyboardType="numeric"
                  placeholderTextColor="#64748b"
                  value={newLon}
                  onChangeText={setNewLon}
                />
              </View>
            </View>

            {modalError && <Text style={styles.errorText}>{modalError}</Text>}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : SkyColors.sky200 }]}
                onPress={() => setShowAddModal(false)}
                disabled={adding}
                activeOpacity={0.7}>
                <Text style={[styles.modalCancelText, { color: '#000000' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAddBtnWrapper}
                onPress={handleManualAdd}
                disabled={adding}
                activeOpacity={0.85}>
                <LinearGradient
                  colors={SkyGradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalAddGradient}>
                  {adding ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalAddText}>Add Place</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  addBtnGradient: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  guestCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  guestCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  guestCardSub: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  guestActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  guestLoginBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  guestLoginBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  guestSignupBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  guestSignupBtnText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '700',
  },
  summaryCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryName: {
    fontSize: 17,
    fontWeight: '800',
  },
  summarySub: {
    fontSize: 12,
    marginTop: 2,
  },
  exploreMapBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  exploreMapBtnText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '800',
  },
  searchWrapper: {
    width: '100%',
    maxWidth: 540,
    marginBottom: 16,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 13.5,
  },
  loadingWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 360,
    marginBottom: 18,
  },
  emptyActionBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  favCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  favCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  favIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  favCoords: {
    fontSize: 12,
    marginTop: 2,
  },
  favActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  actionBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateBtnWrapper: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    // // shadowColor: '#2C5EAD',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.25,
    // shadowRadius: 5,
    // elevation: 3,
  },
  navigateGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  navigateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(228, 87, 66, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(228, 87, 66, 0.35)',
  },
  deleteBtnText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 13.5,
    marginBottom: 12,
  },
  errorText: {
    color: '#E45742',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalAddBtnWrapper: {
    flex: 1.5,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalAddGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
