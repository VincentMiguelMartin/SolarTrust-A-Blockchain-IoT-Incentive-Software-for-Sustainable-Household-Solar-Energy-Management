import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";

export default function StatisticsScreen() {
  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>
          Detailed energy analytics coming here
        </Text>
      </View>

      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 25,
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 35,
  },

  headerTitle: {
    color: "#FFE100",
    fontSize: 28,
    fontWeight: "bold",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  placeholder: {
    color: "#aaa",
    fontSize: 16,
  },
});
