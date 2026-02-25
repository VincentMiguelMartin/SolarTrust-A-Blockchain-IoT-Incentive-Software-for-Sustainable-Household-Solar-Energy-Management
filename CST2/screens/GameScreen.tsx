import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
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
      <Text style={styles.title}>Play to Get Rewards!</Text>

      {/* Middle Content Placeholder */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          A Game will appear in this screen soon
        </Text>
      </View>

      {/* Bottom Section */}
      <View style={{ marginBottom: 80 }}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.navigate("Reward")}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>

        
      </View>

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

  bottomSection: {
    alignItems: "center",
    marginBottom: 100, // controls how high above bottom it sits
  },

  doneButton: {
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
});