import FloatingBackButton from "../components/FloatingBackButton";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { SafeAreaView, Text, StyleSheet } from "react-native";

export default function AboutScreen() {
    const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>About Us</Text>
      <Text style={styles.text}>
        This application monitors solar and grid power usage.
        {"\n\n"}
        Developed by SolarTrust for thesis demonstration purposes.
      </Text>
      <FloatingBackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 30,
    justifyContent: "center",
  },
  title: {
    color: "#FFE100",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
