import React, { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";
import {
  debrisTypes,
  generateGrid,
  cleanCell,
  calculateCleanliness,
  isAllClean,
  GRID_SIZE,
} from "../lib/gameEngine";
import { sendGameCompletion } from "../services/gameService";
import { useEnergy } from "../context/EnergyContext";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MAX_BOARD_WIDTH = 340;

const BOARD_BORDER_WIDTH = 3;
const BOARD_PADDING = 8;
const CELL_GAP = 8;

const RAW_BOARD_SIZE = Math.min(SCREEN_WIDTH - 40, MAX_BOARD_WIDTH);
const INNER_BOARD_WIDTH =
  RAW_BOARD_SIZE - BOARD_BORDER_WIDTH * 2 - BOARD_PADDING * 2;

const CELL_SIZE = Math.floor(
  (INNER_BOARD_WIDTH - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE
);

const BOARD_SIZE =
  BOARD_BORDER_WIDTH * 2 +
  BOARD_PADDING * 2 +
  CELL_SIZE * GRID_SIZE +
  CELL_GAP * (GRID_SIZE - 1);

type DebrisCell = {
  type: string;
  points: number;
  emoji: string;
  cleaned: boolean;
} | null;

function formatTimeRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function getDebrisLabel(type: string) {
  switch (type) {
    case "bird":
      return "Bird Dropping";
    case "leaf":
      return "Leaves";
    case "branch":
      return "Branches";
    case "dust":
      return "Dust";
    default:
      return type;
  }
}

function getPHDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function getNextPHResetTime(now = new Date()) {
  const ph = getPHDateParts(now);

  const currentPHSeconds = ph.hour * 3600 + ph.minute * 60 + ph.second;
  const resetPHSeconds = 1 * 3600; // 1:00:00 AM PHT

  let secondsUntilReset = 0;

  if (currentPHSeconds < resetPHSeconds) {
    secondsUntilReset = resetPHSeconds - currentPHSeconds;
  } else {
    secondsUntilReset = 24 * 3600 - currentPHSeconds + resetPHSeconds;
  }

  return now.getTime() + secondsUntilReset * 1000;
}

function GameCell({
  cell,
  index,
  onPress,
}: {
  cell: DebrisCell;
  index: number;
  onPress: (index: number) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleCellPress = () => {
    if (!cell || cell.cleaned) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    onPress(index);
  };

  const isCleaned = !!cell?.cleaned;
  const isEmpty = cell === null;

  const isLastColumn = (index + 1) % GRID_SIZE === 0;
  const isLastRow = index >= GRID_SIZE * GRID_SIZE - GRID_SIZE;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleCellPress}
      disabled={isEmpty || isCleaned}
      style={[
        styles.cellTouch,
        !isLastColumn && { marginRight: CELL_GAP },
        !isLastRow && { marginBottom: CELL_GAP },
      ]}
    >
      <Animated.View
        style={[
          styles.cell,
          isEmpty && styles.emptyCell,
          isCleaned && styles.cleanedCell,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {!isEmpty && !isCleaned ? (
          <>
            <Text style={styles.cellEmoji}>{cell.emoji}</Text>
            <Text style={styles.cellPoints}>+{cell.points}</Text>
          </>
        ) : isCleaned ? (
          <Text style={styles.cleanedMark}>✨</Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function GameScreen({ navigation }: any) {
  const { selectedPlantId } = useEnergy();
  const [grid, setGrid] = useState<DebrisCell[]>(generateGrid());
  const [score, setScore] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [nextResetAt, setNextResetAt] = useState(getNextPHResetTime());

  const tapPlayer = useAudioPlayer(require("../assets/sounds/Tap.mp3"));

  const playTapSound = () => {
    try {
      tapPlayer.seekTo(0);
      tapPlayer.play();
    } catch (error) {
      console.log("Tap sound could not play:", error);
    }
  };

  const cleanliness = useMemo(() => calculateCleanliness(grid), [grid]);

  const timeRemaining = useMemo(() => {
    return Math.max(nextResetAt - now, 0);
  }, [nextResetAt, now]);

  const timerText = useMemo(() => {
    return formatTimeRemaining(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeRemaining <= 0) {
      handleReset();
    }
  }, [timeRemaining]);

  const handlePressCell = async (index: number) => {
    const result = cleanCell(grid, index);

    if (result.points === 0) return;

    playTapSound();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newScore = score + result.points;

    setGrid(result.grid);
    setScore(newScore);

    if (isAllClean(result.grid)) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      const plantId = selectedPlantId.trim();
      if (plantId) {
        try {
          const response = await sendGameCompletion({
            householdId: plantId,
            cleanliness: 100,
            score: newScore,
          });

          console.log("Backend response:", response);
        } catch (error) {
          console.error("API error:", error);
        }
      } else {
        console.warn("No plant selected; game session not recorded.");
      }

      setShowModal(true);
    }
  };

  const handleReset = () => {
    const currentTime = Date.now();

    setGrid(generateGrid());
    setScore(0);
    setShowModal(false);
    setNow(currentTime);
    setNextResetAt(getNextPHResetTime(new Date(currentTime)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.push("Menu")}
          activeOpacity={0.6}
        >
          <MaterialIcons name="menu" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.push("Notifications")}
          activeOpacity={0.6}
        >
          <MaterialIcons name="notifications-none" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Play to Get Rewards!</Text>
        <Text style={styles.subtitle}>
          Clean the solar panel to earn points and complete the maintenance task.
        </Text>

        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Cleanliness</Text>
            <Text style={styles.statValue}>{cleanliness}%</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Reset In</Text>
            <Text style={styles.resetText}>{timerText}</Text>
          </View>
        </View>

        <View style={styles.board}>
          {grid.map((cell, index) => (
            <GameCell
              key={index}
              cell={cell}
              index={index}
              onPress={handlePressCell}
            />
          ))}
        </View>

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Debris Values</Text>

          <View style={styles.legendRow}>
            {debrisTypes.map((item) => (
              <View key={item.type} style={styles.legendItem}>
                <Text style={styles.legendEmoji}>{item.emoji}</Text>
                <View>
                  <Text style={styles.legendLabel}>
                    {getDebrisLabel(item.type)}
                  </Text>
                  <Text style={styles.legendPoints}>+{item.points} pts</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 90 }} />
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalSparkle}>✨</Text>
            <Text style={styles.modalTitle}>All Clean!</Text>
            <Text style={styles.modalSubtitle}>
              Your maintenance task is complete.
            </Text>
            <Text style={styles.modalSmall}>
              The game will reset at 1:00 AM Philippine Time.
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => {
                setShowModal(false);
                navigation.replace("Reward");
              }}
            >
              <Text style={styles.modalButtonText}>Go to Rewards</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FloatingBackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  title: {
    color: "#32702f",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  subtitle: {
    color: "#000",
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 15,
    color: "#444",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#32702f",
  },
  resetText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
  },
  board: {
    width: BOARD_SIZE,
    alignSelf: "center",
    backgroundColor: "#1E47D8",
    borderRadius: 24,
    padding: BOARD_PADDING,
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 22,
    borderWidth: BOARD_BORDER_WIDTH,
    borderColor: "#2349B5",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  cellTouch: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cell: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    backgroundColor: "#2956df",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0b267d",
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyCell: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  cleanedCell: {
    backgroundColor: "#4a7cff",
    borderColor: "rgba(255,255,255,0.18)",
    opacity: 0.9,
  },
  cellEmoji: {
    fontSize: 30,
    marginBottom: 3,
  },
  cellPoints: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
    opacity: 0.9,
  },
  cleanedMark: {
    fontSize: 22,
  },
  legendCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#32702f",
    marginBottom: 14,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  legendItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
  },
  legendEmoji: {
    fontSize: 28,
    marginRight: 10,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
  legendPoints: {
    fontSize: 13,
    color: "#32702f",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalCard: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  modalSparkle: {
    fontSize: 42,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#32702f",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#000000",
    marginBottom: 12,
    textAlign: "center",
  },
  modalSmall: {
    fontSize: 13,
    color: "#777070",
    marginBottom: 18,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#32702f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  modalButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
});