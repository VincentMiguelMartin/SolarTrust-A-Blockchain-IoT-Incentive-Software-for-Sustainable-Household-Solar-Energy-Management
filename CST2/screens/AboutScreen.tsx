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
    backgroundColor: "#ffffff",
    padding: 30,
    justifyContent: "center",
  },
  title: {
    color: "#32702f",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  text: {
    color: "#000",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
