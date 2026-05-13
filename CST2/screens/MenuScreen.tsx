import React, { useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import FloatingBackButton from "../components/FloatingBackButton";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

export default function MenuScreen({ navigation }: Props) {
  const { logout } = useContext(AuthContext);

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>

        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 28 }} />

      </View>

      {/* MENU OPTIONS */}
      <View style={styles.menuArea}>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.push("Settings")}
        >
          <Text style={styles.text}>Account Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.push("Reports")}
        >
          <Text style={styles.text}>Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.push("About")}
        >
          <Text style={styles.text}>About Us</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.logout]}
          onPress={handleLogout}
        >
          <Text style={styles.text}>Sign Out</Text>
        </TouchableOpacity>

      </View>

      <FloatingBackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 25,
    paddingTop: 60
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 35
  },

  headerTitle: {
    color: "#32702f",
    fontSize: 28,
    fontWeight: "bold"
  },

  /* MENU AREA */
  menuArea: {
    marginTop: 10
  },

  button: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 18,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333"
  },

  logout: {
    marginTop: 30,
  },

  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600"
  },


});
