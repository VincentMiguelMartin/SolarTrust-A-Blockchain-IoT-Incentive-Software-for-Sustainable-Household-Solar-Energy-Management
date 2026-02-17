import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform } from "react-native";
import React from "react";
import { SafeAreaView, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import FloatingBackButton from "../components/FloatingBackButton";


export default function ReportsScreen() {
  const navigation = useNavigation<any>();

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const onFromChange = (_: any, selectedDate?: Date) => {
    setShowFromPicker(Platform.OS === "ios");
    if (selectedDate) setFromDate(selectedDate);
  };

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
