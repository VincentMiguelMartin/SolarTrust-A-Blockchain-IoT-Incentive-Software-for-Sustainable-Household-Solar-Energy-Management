import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.placeholder}>No notifications yet</Text>
      </View>

      {/* BACK BUTTON */}
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
    alignItems: "center",
    justifyContent: "center",
  },

  placeholder: {
    color: "#888",
    fontSize: 16,
  },
});
