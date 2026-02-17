import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";

import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";

/* THIS connects the screen to the real navigator */
type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export default function DashboardScreen({ navigation }: Props) {

  return (
    <SafeAreaView style={styles.container}>

      {/* TOP BAR */}
      <View style={styles.topBar}>

        {/* MENU BUTTON */}
        <TouchableOpacity onPress={() => navigation.navigate("Menu")}>
          <MaterialIcons name="menu" size={26} color="white" />
        </TouchableOpacity>

        {/* RIGHT SIDE ICONS */}
        <View style={styles.topRight}>

          {/* WALLET */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.push("Wallet")}
          >
            <Ionicons name="wallet-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* STORE (CART) */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Store")}
          >
            <Ionicons name="cart-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* NOTIFICATIONS */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
          </TouchableOpacity>

        </View>
      </View>

      {/* TITLE */}
      <Text style={styles.title}>DashBoard</Text>

      {/* CARD */}
      <TouchableOpacity
        style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.push("Statistics")}
        >

          <View style={styles.powerRow}>
            <Text style={styles.powerText}>Solar Power: 1066 W</Text>
            <Text style={styles.powerText}>Grid Power: 1519 W</Text>
          </View>

        {/* GRAPH PLACEHOLDER */}
        <View style={styles.graphBox} />
      </TouchableOpacity>

      {/* DETAILS TEXT */}
      <Text style={styles.details}>Click to view full details!</Text>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 50
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15
  },

  topRight: {
    flexDirection: "row",
    alignItems: "center"
  },

  iconButton: {
    marginLeft: 18,
    padding: 4
  },

  title: {
    color: "#FFE100",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20
  },

  card: {
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    padding: 15,
    elevation: 4,
  },

  powerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },

  powerText: {
    color: "#000",
    fontWeight: "600"
  },

  graphBox: {
    height: 160,
    backgroundColor: "#ddd",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbb"
  },

  details: {
    color: "#ffffff",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 25
  },

});
