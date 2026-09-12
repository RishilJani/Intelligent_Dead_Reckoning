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
import { useAuth } from '@/services/authContext';
import {
  FeedbackItem,
  getFeedbacksByUserId,
  addFeedback,
  updateFeedback,
  deleteFeedback,
} from '@/services/feedbackService';

type FilterType = 'all' | 'bugs' | 'suggestions';

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isGuest } = useAuth();

  // Feedbacks state
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // New feedback form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isBug, setIsBug] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit feedback modal state
  const [editingItem, setEditingItem] = useState<FeedbackItem | null>(null);
  const [editText, setEditText] = useState('');
  const [editIsBug, setEditIsBug] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick categories for prompt suggestions
  const quickCategories = [
    '📍 GPS Drift / Offline Fix',
    '⚡ Speed Prediction Model',
    '🗺️ Offline Tile Cache',
    '🔊 Voice Guidance',
    '🎨 Dark / Light Mode',
  ];

  // Fetch feedbacks for current user
  const fetchFeedbacks = useCallback(async (isPullRefresh = false) => {
    const userId = user?.user_id || user?.id;
    if (!userId || isGuest) {
      setFeedbacks([]);
      return;
    }

    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getFeedbacksByUserId(userId);
      setFeedbacks(data);
    } catch (err: any) {
      console.warn('Failed to load user feedbacks:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Handle submit new feedback
  const handleSubmitFeedback = async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setFormError('Please enter your feedback or describe the issue.');
      return;
    }

    const userId = user?.user_id || user?.id;
    if (!userId || isGuest) {
      setFormError('Please sign in or register to submit feedback.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await addFeedback({
        user_id: userId,
        feedback_text: trimmed,
        is_bug: isBug,
      });

      setFeedbackText('');
      setShowCreateModal(false);
      await fetchFeedbacks();
      if (Platform.OS === 'web') {
        window.alert('Feedback submitted successfully! Thank you.');
      } else {
        Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (item: FeedbackItem) => {
    setEditingItem(item);
    setEditText(item.feedback_text);
    setEditIsBug(Boolean(item.is_bug));
    setEditError(null);
  };

  // Handle update feedback
  const handleUpdateFeedback = async () => {
    if (!editingItem) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      setEditError('Feedback text cannot be empty.');
      return;
    }

    setUpdating(true);
    setEditError(null);

    try {
      await updateFeedback(editingItem.feedback_id, {
        feedback_text: trimmed,
        is_bug: editIsBug,
      });

      setEditingItem(null);
      await fetchFeedbacks();
      if (Platform.OS === 'web') {
        window.alert('Feedback updated successfully.');
      } else {
        Alert.alert('Updated', 'Your feedback has been updated.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update feedback.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle delete feedback
  const handleDeleteFeedback = (feedbackId: number) => {
    const executeDelete = async () => {
      try {
        await deleteFeedback(feedbackId);
        setFeedbacks((prev) => prev.filter((f) => f.feedback_id !== feedbackId));
        if (Platform.OS === 'web') {
          window.alert('Feedback deleted successfully.');
        } else {
          Alert.alert('Deleted', 'Feedback has been removed.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to delete feedback.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this feedback report?')) {
        executeDelete();
      }
    } else {
      Alert.alert(
        'Delete Feedback',
        'Are you sure you want to remove this feedback report? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: executeDelete },
        ]
      );
    }
  };

  // Filtered feedbacks
  const filteredFeedbacks = feedbacks.filter((item) => {
    if (filter === 'bugs') return item.is_bug;
    if (filter === 'suggestions') return !item.is_bug;
    return true;
  });

  const totalBugs = feedbacks.filter((f) => f.is_bug).length;
  const totalSuggestions = feedbacks.filter((f) => !f.is_bug).length;
  const totalResolved = feedbacks.filter((f) => f.is_solved).length;

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFeedbacks(true)}
            tintColor="#38bdf8"
          />
        }>
        
        {/* Top Nav Row */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Feedback & Bugs
          </Text>
          <TouchableOpacity
            style={[styles.newBtn, { opacity: isGuest ? 0.6 : 1 }]}
            onPress={() => {
              if (isGuest) {
                router.push('/login');
              } else {
                setShowCreateModal(true);
              }
            }}
            activeOpacity={0.8}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Guest Warning Card */}
        {isGuest ? (
          <View
            style={[
              styles.guestCard,
              {
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
                borderColor: '#f59e0b',
              },
            ]}>
            <View style={styles.guestCardIcon}>
              <Text style={{ fontSize: 24 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guestCardTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Guest Session
              </Text>
              <Text style={[styles.guestCardSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Log in or create an account to report issues, suggest features, and track status.
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
          /* User Stats & Overview */
          <View
            style={[
              styles.overviewCard,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
              },
            ]}>
            <View style={styles.overviewHeader}>
              <View>
                <Text style={[styles.overviewUser, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  {user?.username || 'Navigator'}
                </Text>
                <Text style={[styles.overviewEmail, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {user?.email}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.createReportHeaderBtn}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.85}>
                <Text style={styles.createReportHeaderBtnText}>+ Write Report</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#38bdf8' }]}>{feedbacks.length}</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Total
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#ef4444' }]}>{totalBugs}</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Bugs
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#0ea5e9' }]}>{totalSuggestions}</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Ideas
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#10b981' }]}>{totalResolved}</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Solved
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'all' && styles.filterPillActive,
              { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' },
            ]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.filterPillText,
                { color: filter === 'all' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
              ]}>
              All ({feedbacks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'bugs' && styles.filterPillActiveBug,
              { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' },
            ]}
            onPress={() => setFilter('bugs')}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.filterPillText,
                { color: filter === 'bugs' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
              ]}>
              🐛 Bugs ({totalBugs})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'suggestions' && styles.filterPillActiveIdea,
              { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' },
            ]}
            onPress={() => setFilter('suggestions')}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.filterPillText,
                { color: filter === 'suggestions' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
              ]}>
              💡 Ideas ({totalSuggestions})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={[styles.loadingText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Loading feedback submissions...
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !isGuest && filteredFeedbacks.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
              },
            ]}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={[styles.emptyTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              No feedback entries found
            </Text>
            <Text style={[styles.emptySub, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {filter === 'all'
                ? 'Encountered an issue with offline dead reckoning or have a suggestion? Share it with the development team!'
                : `No reports matching the '${filter}' filter.`}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.85}>
              <Text style={styles.emptyActionBtnText}>Submit New Feedback</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feedbacks List */}
        {!loading &&
          filteredFeedbacks.map((item) => {
            const isBugReport = Boolean(item.is_bug);
            const isSolved = Boolean(item.is_solved);
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recently';

            return (
              <View
                key={item.feedback_id}
                style={[
                  styles.feedbackCard,
                  {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff',
                    borderColor: isBugReport
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(56, 189, 248, 0.3)',
                  },
                ]}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.badgesRow}>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor: isBugReport
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(2, 132, 199, 0.15)',
                          borderColor: isBugReport ? '#ef4444' : '#0284c7',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.typeBadgeText,
                          { color: isBugReport ? '#ef4444' : '#0284c7' },
                        ]}>
                        {isBugReport ? '🐛 Bug Report' : '💡 Feature Idea'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isSolved
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(234, 179, 8, 0.15)',
                          borderColor: isSolved ? '#10b981' : '#eab308',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isSolved ? '#10b981' : '#eab308' },
                        ]}>
                        {isSolved ? '🟢 Solved' : '⏳ In Review'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardDate, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                    {formattedDate}
                  </Text>
                </View>

                {/* Feedback Body */}
                <Text style={[styles.cardBodyText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  {item.feedback_text}
                </Text>

                {/* Card Actions Footer */}
                <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
                  <Text style={[styles.feedbackIdText, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                    ID #{item.feedback_id}
                  </Text>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.editBtn]}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}>
                      <Text style={styles.editBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.deleteBtn]}
                      onPress={() => handleDeleteFeedback(item.feedback_id)}
                      activeOpacity={0.7}>
                      <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* CREATE FEEDBACK MODAL */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(0,0,0,0.1)',
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Submit Feedback
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type Switcher */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOptionBtn,
                  isBug && styles.typeOptionBtnActiveBug,
                  { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
                ]}
                onPress={() => setIsBug(true)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeOptionText,
                    { color: isBug ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
                  ]}>
                  🐛 Bug Report
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOptionBtn,
                  !isBug && styles.typeOptionBtnActiveIdea,
                  { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
                ]}
                onPress={() => setIsBug(false)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeOptionText,
                    { color: !isBug ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
                  ]}>
                  💡 Suggestion
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Suggestion Chips */}
            <Text style={[styles.chipsLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Quick Topics:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {quickCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chipItem,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                    },
                  ]}
                  onPress={() => {
                    setFeedbackText((prev) => (prev ? `${prev} [${cat}] ` : `[${cat}] `));
                  }}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input area */}
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: isDark ? '#090d16' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                },
              ]}
              multiline
              numberOfLines={5}
              placeholder={
                isBug
                  ? 'Describe the bug: What happened? When did it occur? Steps to reproduce...'
                  : 'Describe your idea: What feature or enhancement would improve your navigation experience?'
              }
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={feedbackText}
              onChangeText={setFeedbackText}
              maxLength={1000}
            />
            <Text style={[styles.charCount, { color: isDark ? '#64748b' : '#94a3b8' }]}>
              {feedbackText.length}/1000 characters
            </Text>

            {formError && <Text style={styles.errorText}>{formError}</Text>}

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1' }]}
                onPress={() => setShowCreateModal(false)}
                disabled={submitting}
                activeOpacity={0.7}>
                <Text style={[styles.modalCancelText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  { backgroundColor: isBug ? '#ef4444' : '#0284c7' },
                ]}
                onPress={handleSubmitFeedback}
                disabled={submitting}
                activeOpacity={0.85}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT FEEDBACK MODAL */}
      <Modal
        visible={Boolean(editingItem)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(0,0,0,0.1)',
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Edit Feedback #{editingItem?.feedback_id}
              </Text>
              <TouchableOpacity
                onPress={() => setEditingItem(null)}
                style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: isDark ? '#94a3b8' : '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type Switcher */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOptionBtn,
                  editIsBug && styles.typeOptionBtnActiveBug,
                  { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
                ]}
                onPress={() => setEditIsBug(true)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeOptionText,
                    { color: editIsBug ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
                  ]}>
                  🐛 Bug Report
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOptionBtn,
                  !editIsBug && styles.typeOptionBtnActiveIdea,
                  { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' },
                ]}
                onPress={() => setEditIsBug(false)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.typeOptionText,
                    { color: !editIsBug ? '#ffffff' : isDark ? '#94a3b8' : '#64748b' },
                  ]}>
                  💡 Suggestion
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: isDark ? '#090d16' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                },
              ]}
              multiline
              numberOfLines={5}
              placeholder="Update your feedback..."
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              value={editText}
              onChangeText={setEditText}
              maxLength={1000}
            />
            <Text style={[styles.charCount, { color: isDark ? '#64748b' : '#94a3b8' }]}>
              {editText.length}/1000 characters
            </Text>

            {editError && <Text style={styles.errorText}>{editError}</Text>}

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1' }]}
                onPress={() => setEditingItem(null)}
                disabled={updating}
                activeOpacity={0.7}>
                <Text style={[styles.modalCancelText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#0284c7' }]}
                onPress={handleUpdateFeedback}
                disabled={updating}
                activeOpacity={0.85}>
                {updating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Changes</Text>
                )}
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
  newBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  newBtnText: {
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
  overviewCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  overviewUser: {
    fontSize: 18,
    fontWeight: '800',
  },
  overviewEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  createReportHeaderBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  createReportHeaderBtnText: {
    color: '#38bdf8',
    fontSize: 12.5,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  filterRow: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  filterPillActiveBug: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  filterPillActiveIdea: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  feedbackCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBodyText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  feedbackIdText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cardActionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  editBtnText: {
    color: '#38bdf8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 11.5,
    fontWeight: '700',
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
    maxWidth: 500,
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
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  typeOptionBtnActiveBug: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  typeOptionBtnActiveIdea: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipsLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  chipsScroll: {
    marginBottom: 12,
    maxHeight: 34,
  },
  chipItem: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  feedbackInput: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 13.5,
    textAlignVertical: 'top',
    minHeight: 120,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 10,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
  modalSubmitBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
