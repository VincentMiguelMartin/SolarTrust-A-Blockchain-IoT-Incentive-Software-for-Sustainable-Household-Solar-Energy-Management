import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";

export default function GameScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
         style={styles.iconButton}
         onPress={() => navigation.push("Menu")}
         activeOpacity={0.6}
        >
         <MaterialIcons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

         <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.push("Notifications")}
          activeOpacity={0.6}
        >
          <MaterialIcons name="notifications-none" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      
      {/* Title */}
      <Text style={styles.title}>Rewards!</Text>

      {/* Placeholder message instead of grid */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Rewards will be displayed here soon
        </Text>
      </View>

      {/* Done Button */}
      <View style={{ marginBottom: 80 }}>
        <TouchableOpacity
         style={styles.homeButton}
         onPress={() => navigation.replace("Dashboard")}
      >
        <Text style={styles.doneText}>Home</Text>
      </TouchableOpacity>

      </View>
      {/* Floating Back Button (under Done) */}
      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 50,
  },

    topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15
  },

    iconButton: {
    padding: 8,
    borderRadius: 20,
  },

    title: {
    color: "#FFE100",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },

  content: {
    flex: 1, // pushes bottomSection down
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  subtitle: {
    color: "#ccc",
    textAlign: "center",
  },

    homeButton: {
    alignSelf: "center",
    backgroundColor: "#FFE100",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 25, // space between Done and FloatingBackButton
    elevation: 5,
  },

  doneText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#000",
  },
});