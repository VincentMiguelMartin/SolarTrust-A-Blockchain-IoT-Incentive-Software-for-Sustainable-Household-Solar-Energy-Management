import React from "react";
import { SafeAreaView, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import FloatingBackButton from "../components/FloatingBackButton";


export default function ReportsScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Power Usage Reports</Text>
      <Text style={styles.text}>Hourly • Daily • Monthly</Text>

      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#FFE100",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 10,
  },
  text: {
    color: "#fff",
    fontSize: 16,
  },
});
